import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, p, q, validate } from "../common/middleware.js";
import { contentBody, httpUrl, idParam, pagination, paginate, stripPrivateQuestion } from "../common/schemas.js";
import { conflict, forbidden, notFound, badRequest } from "../common/errors.js";
import { isOwnerOrAdmin, requireRole } from "../auth/guards.js";
import { Assignment, Exam, ExamAttempt, Profile, Question, Submission } from "../models/index.js";
import { canAccessPaid } from "../services/entitlement.js";
import { gradeMcqExam, isAutoGradable } from "../services/auto-grade.js";
import { deleteSuperseded } from "../services/submission-cleanup.js";

// Total marks = sum of question marks. Rejects dead question IDs and passing > total.
async function checkExamQuestions(questionIds: string[], passingMarks: number) {
  const docs = await Question.find({ _id: { $in: questionIds } }).select("marks").lean();
  if (docs.length !== questionIds.length)
    throw badRequest(`${questionIds.length - docs.length} question(s) not found — check the IDs.`);
  const total = docs.reduce((s: number, d: any) => s + (typeof d.marks === "number" ? d.marks : 1), 0);
  if (passingMarks > total) throw badRequest(`Passing marks (${passingMarks}) exceed total marks (${total}).`);
  return total;
}

export function learningRouter(deps: { requireAuth: any; verified: any[]; optionalAuth: any }) {
  const r = Router(); const { requireAuth, verified, optionalAuth } = deps;
  const teacherOrAdmin = requireRole("teacher", "admin");

  // Unified "All Tests" list for the signed-in teacher: exams (quiz/written/problem/project)
  // merged with legacy assignments (project), newest first, 20-per-page style pagination.
  // New projects are saved in Exams (kind="project") with their link/file slots as
  // Questions; the Assignment collection is only read here for backward compatibility.
  // A test whose deadline has passed is reported in the exclusive "archived" bucket.
  r.get("/my-tests", requireAuth, ...verified, teacherOrAdmin, validate(pagination.extend({
    type: z.enum(["quiz", "written", "problem", "project"]).optional(),
    exclude: z.string().max(100).regex(/^[a-z,]*$/).optional(),
    tab: z.enum(["all", "published", "drafts", "archived"]).optional().default("all"),
  }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const ownerId = req.user!.id;
    const esc = String(query.search ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchFilter: any = esc
      ? { $or: [{ title: { $regex: esc, $options: "i" } }, { description: { $regex: esc, $options: "i" } }, { videoId: { $regex: esc, $options: "i" } }] }
      : {};
    const wantLegacyProjects = !query.type || query.type === "project";
    const excluded: string[] = String(query.exclude ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const examKind = query.type ? { kind: query.type } : excluded.length ? { kind: { $nin: excluded } } : {};
    const legacyKindOk = !excluded.includes("project");
    const [exams, assignments] = await Promise.all([
      Exam.find({ ownerId, ...examKind, ...searchFilter }).sort({ createdAt: -1 }).lean(),
      wantLegacyProjects && legacyKindOk ? Assignment.find({ ownerId, ...searchFilter }).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
    ]);
    const now = Date.now();
    const norm = (d: any, source: "exam" | "assignment") => {
      const deadline = source === "exam" ? (d.endsAt ?? null) : (d.dueAt ?? null);
      const archived = deadline ? new Date(deadline).getTime() < now : false;
      return {
        _id: String(d._id), source,
        kind: source === "assignment" ? "project" : (d.kind ?? "quiz"),
        title: d.title, description: d.description ?? "", tags: d.tags ?? [],
        visibility: d.visibility, status: d.status, price: d.price ?? 0, currency: d.currency ?? "BDT",
        videoId: d.videoId ?? "", deadline,
        questionCount: source === "exam" ? (d.questionIds?.length ?? 0) : 0,
        maxAttempts: source === "exam" ? d.maxAttempts : null,
        maxScore: source === "assignment" ? d.maxScore : (d.maxScore ?? null),
        archived,
        createdAt: d.createdAt, updatedAt: d.updatedAt,
      };
    };
    const all = [...exams.map((d: any) => norm(d, "exam")), ...assignments.map((d: any) => norm(d, "assignment"))]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const bucket = (t: any) => (t.archived ? "archived" : t.status === "published" ? "published" : "drafts");
    const counts = {
      all: all.length,
      published: all.filter((t) => bucket(t) === "published").length,
      drafts: all.filter((t) => bucket(t) === "drafts").length,
      archived: all.filter((t) => bucket(t) === "archived").length,
    };
    let filtered = query.tab === "all" ? all : all.filter((t) => bucket(t) === query.tab);
    if (query.status && ["published", "draft"].includes(query.status)) filtered = filtered.filter((t) => t.status === query.status);
    ok(res, { items: filtered.slice(skip, skip + limit), total: filtered.length, page: query.page, limit, counts });
  }));

  r.get("/exams", optionalAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const { skip, limit } = paginate(q(req));
    const mine = req.query.mine === "1" && req.user ? true : false;
    const filter: any = mine ? { ownerId: req.user!.id } : { status: "published", visibility: "public" };
    const [docs, total] = await Promise.all([Exam.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Exam.countDocuments(filter)]);
    // Owners keep their question IDs; everyone else gets only the count.
    const items = docs.map((e: any) => {
      const { questionIds, ...rest } = e;
      const questionCount = (questionIds ?? []).length;
      return mine ? { ...rest, questionIds, questionCount } : { ...rest, questionCount };
    });
    ok(res, { items, total });
  }));
  r.get("/exams/:id", optionalAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc = await Exam.findById(p(req).id); if (!doc) throw notFound();
    const owner = req.user && isOwnerOrAdmin(req.user, doc.ownerId);
    if (!owner && doc.status !== "published") throw notFound();
    if (!owner && doc.price > 0 && (!req.user || !(await canAccessPaid(req.user, doc, "exam", doc.id)))) throw forbidden("Purchase required");
    const o: any = doc.toObject(); if (!owner) delete o.questionIds;
    ok(res, o);
  }));
  // Student-facing preview: safe metadata only (never answers/rubrics/keys).
  // Item details (problem links, project slots/criteria) are included only when
  // the test is free, the student is entitled, or the requester owns the test.
  r.get("/exams/:id/preview", optionalAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc: any = await Exam.findById(p(req).id).lean(); if (!doc) throw notFound();
    const owner = req.user && isOwnerOrAdmin(req.user, doc.ownerId);
    if (!owner && (doc.status !== "published" || doc.visibility === "private")) throw notFound();
    const entitled = owner || (req.user && doc.price > 0 ? await canAccessPaid(req.user, doc, "exam", doc._id) : true);
    const showDetails = Boolean(owner) || doc.price <= 0 || entitled;
    const qids: string[] = (doc.questionIds ?? []).map(String);
    const qs = qids.length
      ? await Question.find({ _id: { $in: qids } }).select("title type marks prompt rubric").lean()
      : [];
    const byId = new Map(qs.map((q: any) => [String(q._id), q]));
    const ordered = qids.map((id) => byId.get(id)).filter(Boolean);
    const totalMarks = ordered.reduce((s: number, q: any) => s + (typeof q.marks === "number" ? q.marks : 1), 0);
    let details: unknown = null;
    if (showDetails) {
      if (doc.kind === "problem") {
        details = {
          problems: ordered.map((q: any) => ({ title: q.title, url: typeof q.rubric === "string" ? q.rubric : "" })),
        };
      } else if (doc.kind === "project") {
        details = {
          criteria: Array.isArray(doc.rubric) ? doc.rubric : [],
          slots: ordered.map((q: any) => ({ title: q.title, type: q.type })),
          submissionTypes: doc.submissionTypes ?? [],
          maxFileSize: doc.maxFileSize ?? "",
          maxFiles: doc.maxFiles ?? 1,
        };
      }
    }
    ok(res, {
      _id: String(doc._id), ownerId: doc.ownerId, title: doc.title, description: doc.description ?? "",
      tags: doc.tags ?? [], visibility: doc.visibility, status: doc.status,
      price: doc.price ?? 0, currency: doc.currency ?? "BDT",
      kind: doc.kind ?? "quiz", durationMinutes: doc.durationMinutes, maxAttempts: doc.maxAttempts,
      accessPolicy: doc.accessPolicy, passingMarks: doc.passingMarks ?? 0,
      startsAt: doc.startsAt ?? null, endsAt: doc.endsAt ?? null,
      playlistId: doc.playlistId ?? null, videoId: doc.videoId ?? "",
      questionCount: qids.length, totalMarks, entitled: Boolean(entitled), details,
      createdAt: doc.createdAt,
    });
  }));
  const examExtras = {
    questionIds: z.array(z.string().max(100)).max(500).optional().default([]),
    durationMinutes: z.number().int().min(1).max(1440),
    maxAttempts: z.number().int().min(1).max(20).nullable().optional().default(1),
    startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(),
    accessPolicy: z.enum(["free", "paid", "enrolled"]).optional().default("free"),
    passingMarks: z.number().min(0).optional().default(0),
    playlistId: z.string().max(100).nullable().optional(),
    videoId: z.string().max(100).optional().default(""),
    kind: z.enum(["quiz", "written", "problem", "project"]).optional().default("quiz"),
    // Project extras (only used when kind === "project"; ignored otherwise).
    maxScore: z.number().min(1).max(10000).optional(),
    submissionTypes: z.array(z.string().max(20)).max(10).optional().default([]),
    maxFileSize: z.string().max(50).optional().default(""),
    maxFiles: z.number().int().min(1).max(10).optional().default(1),
    rubric: z.unknown().optional(),
  };
  const examBody = contentBody.extend(examExtras);
  r.post("/exams", requireAuth, ...verified, teacherOrAdmin, validate(examBody), asyncHandler(async (req, res) => {
    await checkExamQuestions(req.body.questionIds ?? [], req.body.passingMarks ?? 0);
    ok(res, await Exam.create({ ...req.body, ownerId: req.user!.id }), 201);
  }));
  r.patch("/exams/:id", requireAuth, ...verified, validate(idParam, "params"), validate(examBody.partial()), asyncHandler(async (req, res) => {
    const doc: any = await Exam.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
    const questionIds = (req.body.questionIds ?? doc.questionIds ?? []).map(String);
    const passingMarks = Number(req.body.passingMarks ?? doc.passingMarks ?? 0);
    if (req.body.questionIds !== undefined || req.body.passingMarks !== undefined)
      await checkExamQuestions(questionIds, passingMarks);
    Object.assign(doc, req.body); await doc.save(); ok(res, doc);
  }));

  // Attempts — answers are private to the student, the owning teacher, and admin
  r.post("/exams/:id/attempts", requireAuth, ...verified, requireRole("student", "admin"), validate(idParam, "params"), asyncHandler(async (req, res) => {
    const exam = await Exam.findById(p(req).id); if (!exam || exam.status !== "published") throw notFound();
    if (exam.startsAt && new Date() < exam.startsAt) throw forbidden("Exam not yet open");
    if (exam.endsAt && new Date() > exam.endsAt) throw forbidden("Exam closed");
    if (!(await canAccessPaid(req.user!, exam, "exam", exam.id))) throw forbidden("Purchase required");
    const count = await ExamAttempt.countDocuments({ studentId: req.user!.id, examId: exam.id });
    if (exam.maxAttempts != null && count >= exam.maxAttempts) throw conflict("Attempt limit reached");
    ok(res, await ExamAttempt.create({ studentId: req.user!.id, examId: exam.id, attemptNumber: count + 1 }), 201);
  }));
  // Teacher view: every attempt on one exam, with student name/email attached.
  // Students resolve via Profile (safe fields only); unknown ids fall back to a short id.
  r.get("/exams/:id/attempts", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"),
    validate(pagination.extend({
      from: z.string().datetime().optional(), to: z.string().datetime().optional(),
      sort: z.enum(["latest", "oldest", "highest", "lowest"]).optional().default("latest"),
      // latest=1 → only the current (newest) attempt per student, for teacher feedback.
      latest: z.string().optional(),
      // submittedOnly=1 → only submitted/graded attempts count as submissions.
      // Merely starting an attempt (in_progress) never counts as a submission.
      submittedOnly: z.string().optional(),
      // pendingOnly=1 → only ungraded submissions (state=submitted). Graded
      // work lives only in the Archive and is hidden from every other
      // teacher listing.
      pendingOnly: z.string().optional(),
    }), "query"), asyncHandler(async (req, res) => {
      const exam = await Exam.findById(p(req).id); if (!exam) throw notFound();
      if (!isOwnerOrAdmin(req.user!, exam.ownerId)) throw forbidden("Only the exam owner may list attempts");
      const query = q(req); const { skip, limit } = paginate(query);
      const filter: any = { examId: exam.id };
      if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) filter.createdAt.$lte = new Date(query.to);
      }
      const search = String(query.search ?? "").trim();
      if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const profiles = await Profile.find({
          $or: [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }],
        }).select("userId").limit(50).lean();
        filter.$or = [
          { studentId: { $in: profiles.map((x: any) => String(x.userId)) } },
          { studentId: { $regex: safe, $options: "i" } },
        ];
      }
      const sortMap: Record<string, any> = {
        latest: { createdAt: -1 }, oldest: { createdAt: 1 },
        highest: { score: -1 }, lowest: { score: 1 },
      };
      const sort = sortMap[String(query.sort ?? "latest")] ?? sortMap.latest;
      // Only submitted/graded work is a submission — an in_progress attempt
      // (student merely opened the test) is never counted or listed as one.
      if (String(query.submittedOnly ?? "") === "1") filter.state = { $in: ["submitted", "graded"] };
      if (String(query.pendingOnly ?? "") === "1") filter.state = "submitted";
      let items: any[];
      let total: number;
      if (String(query.latest ?? "") === "1") {
        // Teacher feedback mode: only the current (newest) attempt per student.
        // Group first, then sort + paginate the per-student latest docs.
        const agg: any[] = await ExamAttempt.aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $group: { _id: "$studentId", doc: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$doc" } },
          { $sort: sort },
          { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: "n" }] } },
        ]);
        items = agg[0]?.items ?? [];
        total = agg[0]?.total?.[0]?.n ?? 0;
      } else {
        [items, total] = await Promise.all([
          ExamAttempt.find(filter).sort(sort).skip(skip).limit(limit).lean(),
          ExamAttempt.countDocuments(filter),
        ]);
      }
      const ids = [...new Set(items.map((a: any) => String(a.studentId)))];
      const profiles = ids.length
        ? await Profile.find({ userId: { $in: ids } }).select("userId name email avatarUploadId").lean()
        : [];
      const byId = new Map(profiles.map((x: any) => [String(x.userId), x]));
      const withStudents = items.map((a: any) => {
        const s: any = byId.get(String(a.studentId));
        return {
          ...a,
          student: s
            ? { userId: String(s.userId), name: s.name || "Unnamed student", email: s.email || "", avatarUploadId: s.avatarUploadId ?? null }
            : { userId: String(a.studentId), name: `Student ${String(a.studentId).slice(0, 8)}…`, email: "", avatarUploadId: null },
        };
      });
      ok(res, { items: withStudents, total, page: query.page, limit });
    }));
  r.patch("/exam-attempts/:id/submit", requireAuth, ...verified, validate(idParam, "params"), validate(z.object({ answers: z.record(z.string().max(100), z.unknown()) })), asyncHandler(async (req, res) => {
    const a = await ExamAttempt.findById(p(req).id); if (!a) throw notFound();
    if (a.studentId !== req.user!.id && req.user!.role !== "admin") throw forbidden();
    if (a.state !== "in_progress") throw conflict("Attempt already submitted");
    const exam = await Exam.findById(a.examId);
    if (exam && Date.now() - new Date(a.startedAt).getTime() > exam.durationMinutes * 60000 + 60000) throw forbidden("Time expired");
    a.answers = req.body.answers; a.state = "submitted"; a.submittedAt = new Date();
    // Instant grading: all-MCQ exams are checked server-side the moment they are submitted.
    const qs = exam ? await Question.find({ _id: { $in: exam.questionIds ?? [] } }).lean() : [];
    if (qs.length && isAutoGradable(qs)) {
      const g = gradeMcqExam(qs, (a.answers ?? {}) as Record<string, unknown>);
      a.score = g.score; a.feedback = g.feedback; a.state = "graded";
    }
    await a.save();
    // Resubmitting replaces previous ungraded attempts of this test (graded
    // history is permanent, as are their files while still referenced).
    const prevAttempts = await ExamAttempt.find({
      studentId: a.studentId, examId: a.examId, state: "submitted", _id: { $ne: a._id },
    }).lean();
    await deleteSuperseded(String(a.studentId), [], prevAttempts);
    ok(res, a);
  }));
  r.get("/exam-attempts/me", requireAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const { skip, limit } = paginate(q(req));
    const [items, total] = await Promise.all([ExamAttempt.find({ studentId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), ExamAttempt.countDocuments({ studentId: req.user!.id })]);
    ok(res, { items, total });
  }));
  // Frontend sync: questions for an in-progress attempt (answers/rubrics stripped for students)
  r.get("/exam-attempts/:id/questions", requireAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const a = await ExamAttempt.findById(p(req).id); if (!a) throw notFound();
    const exam = await Exam.findById(a.examId); if (!exam) throw notFound();
    const isStudentOwner = a.studentId === req.user!.id;
    const allowed = isStudentOwner || req.user!.role === "admin" || exam.ownerId === req.user!.id;
    if (!allowed) throw forbidden();
    const docs = await Question.find({ _id: { $in: exam.questionIds ?? [] } }).lean();
    const byId = new Map(docs.map((d: any) => [String(d._id), d]));
    // Defensive: ignore duplicate ids in questionIds (each question shows once).
    const seen = new Set<string>();
    const qids: string[] = [];
    for (const id of (exam.questionIds ?? []).map(String)) {
      if (seen.has(id)) continue;
      seen.add(id);
      qids.push(id);
    }
    // Graded students may review the correct options + explanations; everyone else gets them stripped.
    const reveal = a.state === "graded" && (isStudentOwner || req.user!.role !== "student" || exam.ownerId === req.user!.id);
    const items = qids.map((id: string) => byId.get(String(id))).filter(Boolean).map((d: any) => {
      const stripped: any = stripPrivateQuestion(d, !isStudentOwner || req.user!.role !== "student");
      if (reveal) {
        const full: any = byId.get(String(d._id));
        stripped.correctOptions = full?.correctOptions ?? [];
        stripped.explanation = full?.explanation ?? "";
      }
      return stripped;
    });
    ok(res, { items, total: items.length, examId: String(exam._id), attemptId: String(a._id), state: a.state });
  }));
  r.get("/exam-attempts/:id", requireAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const a = await ExamAttempt.findById(p(req).id); if (!a) throw notFound();
    const exam = await Exam.findById(a.examId);
    const allowed = a.studentId === req.user!.id || req.user!.role === "admin" || (exam && exam.ownerId === req.user!.id);
    if (!allowed) throw forbidden();
    // Students see score/feedback only after grading
    if (a.studentId === req.user!.id && req.user!.role === "student" && a.state !== "graded") { const o: any = a.toObject(); o.score = null; o.feedback = ""; return ok(res, o); }
    ok(res, a);
  }));
  r.patch("/exam-attempts/:id/grade", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"), validate(z.object({
    score: z.number().min(0).max(100000).optional(),
    feedback: z.string().max(5000).default(""),
    breakdown: z.array(z.object({
      key: z.string().max(100).default(""),
      label: z.string().max(200).default(""),
      maxMarks: z.number().min(0).max(100000).default(0),
      marks: z.number().min(0).max(100000),
      comment: z.string().max(5000).default(""),
    })).max(500).optional(),
  })), asyncHandler(async (req, res) => {
    const a = await ExamAttempt.findById(p(req).id); if (!a) throw notFound();
    const exam = await Exam.findById(a.examId); if (!exam) throw notFound();
    if (!isOwnerOrAdmin(req.user!, exam.ownerId)) throw forbidden("Only the exam owner may grade");
    const breakdown = req.body.breakdown as Array<{ key: string; label: string; maxMarks: number; marks: number; comment: string }> | undefined;
    if (breakdown) {
      for (const b of breakdown) {
        if (b.maxMarks > 0 && b.marks > b.maxMarks) throw forbidden(`Marks (${b.marks}) exceed max (${b.maxMarks}) for "${b.label || b.key}".`);
      }
      // Itemized grading is authoritative: total = sum of item marks.
      a.score = Math.round(breakdown.reduce((s, b) => s + b.marks, 0) * 100) / 100;
      a.set("breakdown", breakdown);
    } else {
      if (req.body.score === undefined) throw badRequest("Provide a score or an itemized breakdown.");
      a.score = req.body.score;
    }
    a.feedback = req.body.feedback; a.state = "graded"; await a.save(); ok(res, a);
  }));

  // Flat per-submission queue for the teacher: one row per student's current
  // submission (latest per student per test) across written/project exams and
  // legacy assignments. Submissions & Feedback uses state=pending, the Archive
  // uses state=graded — graded work never appears in the pending view.
  // Only submitted work counts: in_progress attempts are never submissions.
  r.get("/submission-queue/items", requireAuth, ...verified, teacherOrAdmin, validate(pagination.extend({
    state: z.enum(["pending", "graded"]).optional().default("pending"),
    type: z.enum(["written", "project"]).optional(),
    from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { limit } = paginate(query);
    const page = query.page;
    const ownerId = req.user!.id;
    const esc = String(query.search ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRx = esc ? new RegExp(esc, "i") : null;
    const examKindFilter: any = query.type && query.type !== "project" ? { kind: query.type } : {};
    const wantLegacy = !query.type || query.type === "project";
    const [exams, assignments] = await Promise.all([
      Exam.find({ ownerId, kind: { $in: ["written", "project"] }, ...examKindFilter }).select("_id title kind").lean(),
      wantLegacy ? Assignment.find({ ownerId }).select("_id title").lean() : Promise.resolve([]),
    ]);
    const examById = new Map(exams.map((e: any) => [String(e._id), e]));
    const assignById = new Map(assignments.map((a: any) => [String(a._id), a]));
    const allExamIds = [...examById.keys()];
    const allAssignIds = [...assignById.keys()];
    const titleExamIds = allExamIds.filter((id) => !titleRx || titleRx.test(examById.get(id)?.title ?? ""));
    const titleAssignIds = allAssignIds.filter((id) => !titleRx || titleRx.test(assignById.get(id)?.title ?? ""));
    const graded = String(query.state ?? "pending") === "graded";
    const attemptStates = graded ? ["graded"] : ["submitted"];
    const submissionStates = graded ? ["graded"] : ["submitted", "under_review", "returned"];
    const dateFilter: any = {};
    if (query.from || query.to) {
      dateFilter.createdAt = {};
      if (query.from) dateFilter.createdAt.$gte = new Date(query.from);
      if (query.to) dateFilter.createdAt.$lte = new Date(query.to);
    }
    // Search text matches a test title OR a student name/email.
    let studentIds: string[] | null = null;
    if (esc) {
      const profiles = await Profile.find({
        $or: [{ name: { $regex: esc, $options: "i" } }, { email: { $regex: esc, $options: "i" } }],
      }).select("userId").limit(100).lean().catch(() => []);
      studentIds = profiles.map((x: any) => String(x.userId));
    }
    const idScope = (field: string, titleIds: string[], allIds: string[]) => {
      if (!esc) return { [field]: { $in: titleIds } };
      const or: any[] = [];
      if (titleIds.length) or.push({ [field]: { $in: titleIds } });
      if (studentIds?.length) or.push({ [field]: { $in: allIds }, studentId: { $in: studentIds } });
      if (!or.length) return { [field]: { $in: [] } };
      return or.length === 1 ? or[0] : { $or: or };
    };
    const [attemptGroups, submissionGroups] = await Promise.all([
      allExamIds.length ? ExamAttempt.aggregate([
        { $match: { ...idScope("examId", titleExamIds, allExamIds), state: { $in: attemptStates }, ...dateFilter } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { test: "$examId", student: "$studentId" }, doc: { $first: "$$ROOT" } } },
      ]) : Promise.resolve([]),
      allAssignIds.length ? Submission.aggregate([
        { $match: { ...idScope("assignmentId", titleAssignIds, allAssignIds), state: { $in: submissionStates }, ...dateFilter } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { test: "$assignmentId", student: "$studentId" }, doc: { $first: "$$ROOT" } } },
      ]) : Promise.resolve([]),
    ]);
    const flat: { doc: any; source: "exam" | "assignment" }[] = [
      ...attemptGroups.map((g: any) => ({ doc: g.doc, source: "exam" as const })),
      ...submissionGroups.map((g: any) => ({ doc: g.doc, source: "assignment" as const })),
    ];
    const sids = [...new Set(flat.map((f) => String(f.doc.studentId)))];
    const sprofiles = sids.length
      ? await Profile.find({ userId: { $in: sids } }).select("userId name email avatarUploadId").lean().catch(() => [])
      : [];
    const bySid = new Map(sprofiles.map((x: any) => [String(x.userId), x]));
    const dateMs = (v: any) => {
      const t = v ? +new Date(v) : NaN;
      return Number.isNaN(t) ? 0 : t;
    };
    const items = flat.map(({ doc, source }) => {
      const a: any = doc;
      const s: any = bySid.get(String(a.studentId));
      const test: any = source === "exam" ? examById.get(String(a.examId)) : assignById.get(String(a.assignmentId));
      return {
        id: String(a._id),
        source,
        testId: source === "exam" ? String(a.examId) : String(a.assignmentId),
        testTitle: test?.title ?? (source === "exam" ? "Test" : "Project"),
        kind: source === "exam" ? String(test?.kind ?? "written") : "project",
        student: {
          userId: String(a.studentId),
          name: s?.name || "Unnamed student",
          email: s?.email || "",
          avatarUploadId: s?.avatarUploadId ?? null,
        },
        state: a.state,
        score: source === "exam" ? (a.score ?? null) : (a.grade ?? null),
        attemptNumber: source === "exam" ? (a.attemptNumber ?? null) : null,
        submittedAt: a.submittedAt ?? a.createdAt ?? null,
      };
    }).sort((x, y) => dateMs(y.submittedAt) - dateMs(x.submittedAt));
    const total = items.length;
    const start = (page - 1) * limit;
    ok(res, { items: items.slice(start, start + limit), total, page, limit });
  }));

  r.post("/assignments", requireAuth, ...verified, teacherOrAdmin, validate(contentBody.extend({ dueAt: z.string().datetime().optional(), maxScore: z.number().min(1).max(10000).default(100), maxAttempts: z.number().int().min(1).max(20).nullable().default(1), videoId: z.string().max(100).optional().default("") })), asyncHandler(async (req, res) => ok(res, await Assignment.create({ ...req.body, ownerId: req.user!.id }), 201)));
  r.get("/assignments", optionalAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const { skip, limit } = paginate(q(req));
    const filter: any = req.query.mine === "1" && req.user ? { ownerId: req.user.id } : { status: "published", visibility: "public" };
    const [items, total] = await Promise.all([Assignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Assignment.countDocuments(filter)]);
    ok(res, { items, total });
  }));
  r.get("/assignments/:id", optionalAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc = await Assignment.findById(p(req).id); if (!doc) throw notFound();
    if (!(req.user && isOwnerOrAdmin(req.user, doc.ownerId)) && doc.status !== "published") throw notFound();
    ok(res, doc);
  }));
  const assignmentPatch = contentBody.partial().extend({
    dueAt: z.string().datetime().nullable().optional(),
    maxScore: z.number().min(1).max(10000).optional(),
    maxAttempts: z.number().int().min(1).max(20).nullable().optional(),
    videoId: z.string().max(100).optional(),
    passingMarks: z.number().min(0).optional(),
    playlistId: z.string().max(100).nullable().optional(),
    submissionTypes: z.array(z.string().max(20)).max(10).optional(),
    maxFileSize: z.string().max(50).optional(),
    maxFiles: z.number().int().min(1).max(10).optional(),
    rubric: z.unknown().optional(),
  });
  r.patch("/assignments/:id", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"), validate(assignmentPatch), asyncHandler(async (req, res) => {
    const doc: any = await Assignment.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden("Only the owner may edit this test");
    Object.assign(doc, req.body); await doc.save(); ok(res, doc);
  }));
  r.delete("/assignments/:id", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc: any = await Assignment.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden("Only the owner may delete this test");
    await Submission.deleteMany({ assignmentId: String(doc._id) });
    await Assignment.deleteOne({ _id: doc._id });
    ok(res, { id: String(doc._id) });
  }));
  r.delete("/exams/:id", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc: any = await Exam.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden("Only the owner may delete this test");
    // Hard delete: remove questions that belong to this teacher and are used by no other exam.
    const ids: string[] = (doc.questionIds ?? []).map(String);
    const usedElsewhere = new Set(
      (await Exam.find({ _id: { $ne: doc._id }, questionIds: { $in: ids } }).select("questionIds").lean())
        .flatMap((e: any) => (e.questionIds ?? []).map(String)),
    );
    const owned: any[] = ids.length
      ? await Question.find({ _id: { $in: ids }, ownerId: req.user!.id }).select("_id").lean()
      : [];
    const delIds = owned.map((q) => String(q._id)).filter((id) => !usedElsewhere.has(id));
    if (delIds.length) await Question.deleteMany({ _id: { $in: delIds } });
    await Exam.deleteOne({ _id: doc._id });
    ok(res, { id: String(doc._id), deletedQuestions: delIds.length });
  }));

  r.post("/submissions", requireAuth, ...verified, requireRole("student", "admin"), validate(z.object({
    assignmentId: z.string().min(1).max(100), uploadId: z.string().max(100).nullable().optional(),
    repoUrl: httpUrl.optional().or(z.literal("")), liveUrl: httpUrl.optional().or(z.literal("")),
  })), asyncHandler(async (req, res) => {
    const a = await Assignment.findById(req.body.assignmentId); if (!a || a.status !== "published") throw notFound("Assignment not found");
    const sid = String(req.user!.id);
    // Resubmission replaces previous ungraded work (graded history is permanent).
    const prev = await Submission.find({ studentId: sid, assignmentId: String(a._id), state: { $ne: "graded" } }).lean();
    const keptGraded = await Submission.countDocuments({ studentId: sid, assignmentId: String(a._id), state: "graded" });
    // The cap applies to retained submissions: replacing ungraded work never consumes it.
    if (a.maxAttempts != null && keptGraded + 1 > a.maxAttempts) throw conflict("Submission limit reached");
    const created = await Submission.create({ ...req.body, studentId: sid });
    // Previous ungraded submissions and their files (incl. PDFs) are superseded — never throws.
    await deleteSuperseded(sid, prev, []);
    ok(res, created, 201);
  }));
  r.get("/submissions/me", requireAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const { skip, limit } = paginate(q(req));
    const [items, total] = await Promise.all([Submission.find({ studentId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Submission.countDocuments({ studentId: req.user!.id })]);
    ok(res, { items, total });
  }));
  r.get("/submissions/:id", requireAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const s = await Submission.findById(p(req).id); if (!s) throw notFound();
    const a = await Assignment.findById(s.assignmentId);
    const allowed = s.studentId === req.user!.id || req.user!.role === "admin" || (a && a.ownerId === req.user!.id);
    if (!allowed) throw forbidden();
    if (s.studentId === req.user!.id && req.user!.role === "student" && s.state !== "graded") { const o: any = s.toObject(); o.grade = null; o.feedback = ""; return ok(res, o); }
    ok(res, s);
  }));
  r.get("/assignments/:id/submissions", requireAuth, ...verified, validate(idParam, "params"), validate(pagination.extend({
    // latest=1 → only the current (newest) submission per student, for teacher feedback.
    latest: z.string().optional(),
  }), "query"), asyncHandler(async (req, res) => {
    const a = await Assignment.findById(p(req).id); if (!a) throw notFound();
    if (!isOwnerOrAdmin(req.user!, a.ownerId)) throw forbidden("Only the assignment owner may list submissions");
    const { skip, limit } = paginate(q(req));
    const page = q(req).page;
    if (String(q(req).latest ?? "") === "1") {
      const agg: any[] = await Submission.aggregate([
        { $match: { assignmentId: a.id } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$studentId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
        { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: "n" }] } },
      ]);
      const items = agg[0]?.items ?? [];
      const total = agg[0]?.total?.[0]?.n ?? 0;
      return ok(res, { items, total, page, limit });
    }
    const [items, total] = await Promise.all([Submission.find({ assignmentId: a.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Submission.countDocuments({ assignmentId: a.id })]);
    ok(res, { items, total, page, limit });
  }));
  r.patch("/submissions/:id/grade", requireAuth, ...verified, teacherOrAdmin, validate(idParam, "params"), validate(z.object({ grade: z.number().min(0).max(100000), feedback: z.string().max(5000).default("") })), asyncHandler(async (req, res) => {
    const s = await Submission.findById(p(req).id); if (!s) throw notFound();
    const a = await Assignment.findById(s.assignmentId); if (!a) throw notFound();
    if (!isOwnerOrAdmin(req.user!, a.ownerId)) throw forbidden("Only the assignment owner may grade");
    if (req.body.grade > a.maxScore) throw forbidden("Grade exceeds maxScore");
    s.grade = req.body.grade; s.feedback = req.body.feedback; s.state = "graded"; await s.save(); ok(res, s);
  }));
  return r;
}
