import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, q, validate } from "../common/middleware.js";
import { pagination, paginate } from "../common/schemas.js";
import { forbidden, notFound, badRequest } from "../common/errors.js";
import { requireAdmin } from "../auth/guards.js";
import { AuditLog, Comment, Entitlement, Exam, ExamAttempt, Follow, Payout, Playlist, Profile, Purchase, Question, Rating, Report, Video } from "../models/index.js";
import { audit } from "../services/audit.js";
import { findUserByUserId, listUserIdsByRole, normalizeRole, roleMapForUserIds } from "../services/user-roles.js";

const reason = z.string().min(3, "Reason required").max(500);
const CONTENT_MODELS: Record<string, any> = { video: Video, playlist: Playlist, question: Question, exam: Exam, comment: Comment };

export function adminRouter(deps: { requireAuth: any; verified: any[]; authDb?: () => any }) {
  const r = Router(); const { requireAuth, verified } = deps;
  r.use(requireAuth, ...verified, requireAdmin); // every admin route: auth + verified + admin

  r.get("/overview", asyncHandler(async (_req, res) => {
    // Role counts come from the `user` collection; profiles hold no role.
    const userCol = deps.authDb?.()?.collection("user");
    const [users, students, teachers] = userCol
      ? await Promise.all([
        userCol.countDocuments(),
        userCol.countDocuments({ role: "student" }),
        userCol.countDocuments({ role: "teacher" }),
      ])
      : [await Profile.countDocuments(), 0, 0];
    const [videos, playlists, questions, exams, pendingPayments, paidPayments, failedPayments, pendingSubs] = await Promise.all([
      Video.countDocuments({ status: "published" }), Playlist.countDocuments({ status: "published" }), Question.countDocuments({ status: "published" }),
      Exam.countDocuments(), Purchase.countDocuments({ status: "pending" }), Purchase.countDocuments({ status: "paid" }),
      Purchase.countDocuments({ status: "failed" }), ExamAttempt.countDocuments({ state: "submitted" }),
    ]);
    ok(res, { users, students, teachers, published: { videos, playlists, questions }, exams, payments: { pending: pendingPayments, paid: paidPayments, failed: failedPayments }, pendingSubmissions: pendingSubs, pendingPayouts: await countTeachersWithDue() });
  }));
  // Teachers with due payout > 0 (for the overview "Pending payout" card).
  async function countTeachersWithDue(): Promise<number> {
    try {
      const list = await listTeachers();
      if (!list.length) return 0;
      const fin = await teacherFinances(list.map((t) => t.teacherId));
      let n = 0;
      for (const t of list) {
        const e = fin.earned.get(t.teacherId);
        const paid = fin.paidOut.get(t.teacherId) ?? 0;
        if ((e?.total ?? 0) - paid > 0) n++;
      }
      return n;
    } catch {
      return 0;
    }
  }
  r.get("/users", validate(pagination.extend({ role: z.string().max(20).optional() }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const esc = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const userCol = deps.authDb?.()?.collection("user");
    if (!userCol) {
      // Fallback when auth DB is unavailable (e.g. unit tests): profile-only listing.
      const filter: any = {};
      if (query.search) filter.$or = [{ email: { $regex: esc(query.search), $options: "i" } }, { name: { $regex: esc(query.search), $options: "i" } }];
      if (query.status && ["active", "suspended"].includes(query.status)) filter.status = query.status;
      const [profiles, total] = await Promise.all([Profile.find(filter).select("userId email name roleSelected status bio createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Profile.countDocuments(filter)]);
      const roles = await roleMapForUserIds(deps.authDb, profiles.map((p: any) => String(p.userId)));
      const items = profiles.map((p: any) => {
        const u = roles.get(String(p.userId));
        const { role, ...rest } = p;
        void role; // ignore any legacy profile.role lingering in old documents
        return { ...rest, role: u?.role ?? "student", roleSelected: Boolean(u?.roleSelected ?? (p as any).roleSelected) };
      });
      return ok(res, { items, total, page: query.page, limit });
    }
    // Source of truth is the `user` collection; profiles are a left-join for
    // status/bio. This keeps the admin table in sync even for accounts that
    // have never created a profile document yet.
    const userFilter: any = {};
    if (query.role && ["student", "teacher", "admin"].includes(query.role)) userFilter.role = query.role;
    if (query.search) {
      const rx = { $regex: esc(query.search), $options: "i" };
      userFilter.$or = [{ email: rx }, { name: rx }];
    }
    if (query.status && ["active", "suspended"].includes(query.status)) {
      if (query.status === "suspended") {
        const suspended = await Profile.find({ status: "suspended" }).select("userId").lean().catch(() => []);
        const ids = suspended.map((p: any) => String(p.userId));
        if (ids.length === 0) return ok(res, { items: [], total: 0, page: query.page, limit });
        userFilter.id = { $in: ids };
      } else {
        // No profile == active (profiles are lazily created).
        const suspended = await Profile.find({ status: "suspended" }).select("userId").lean().catch(() => []);
        const ids = suspended.map((p: any) => String(p.userId));
        if (ids.length > 0) userFilter.id = { $nin: ids };
      }
    }
    const [users, total] = await Promise.all([
      userCol.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray().catch(() => []),
      userCol.countDocuments(userFilter).catch(() => 0),
    ]);
    const ids: string[] = users.map((u: any) => String(u.id ?? u._id));
    const profiles: any[] = ids.length
      ? await Profile.find({ userId: { $in: ids } }).select("userId email name roleSelected status bio createdAt").lean().catch(() => [])
      : [];
    const pmap = new Map(profiles.map((p: any) => [String(p.userId), p]));
    const items = users.map((u: any) => {
      const uid = String(u.id ?? u._id);
      const p: any = pmap.get(uid);
      return {
        userId: uid,
        email: u.email ?? p?.email ?? "",
        name: u.name ?? p?.name ?? "",
        role: normalizeRole(u?.role),
        roleSelected: Boolean(u?.roleSelected ?? p?.roleSelected),
        status: p?.status ?? "active",
        bio: p?.bio ?? "",
        createdAt: u.createdAt ?? p?.createdAt ?? null,
      };
    });
    // Converge the tables: backfill missing profiles and refresh diverged
    // email/name mirrors (best-effort, never fails the listing).
    const missing = users.filter((u: any) => !pmap.has(String(u.id ?? u._id)));
    if (missing.length) {
      Profile.insertMany(
        missing.map((u: any) => ({ userId: String(u.id ?? u._id), email: u.email ?? "", name: u.name ?? "", roleSelected: Boolean(u.roleSelected) })),
        { ordered: false },
      ).catch(() => undefined);
    }
    for (const u of users) {
      const p: any = pmap.get(String(u.id ?? u._id));
      if (p && (p.email !== u.email || (u.name != null && p.name !== u.name))) {
        Profile.updateOne(
          { userId: String(u.id ?? u._id) },
          { $set: { email: u.email ?? p.email, name: u.name ?? p.name ?? "", roleSelected: Boolean(u.roleSelected ?? p.roleSelected) } },
        ).catch(() => undefined);
      }
    }
    ok(res, { items, total, page: query.page, limit });
  }));
  r.get("/users/:userId", asyncHandler(async (req, res) => {
    const target = await findUserByUserId(deps.authDb, String(req.params.userId));
    let doc: any = await Profile.findOne({ userId: req.params.userId }).select("-__v").lean();
    if (!target && !doc) throw notFound();
    if (!doc && target) {
      // User exists but has no profile yet — backfill so the tables stay in sync.
      doc = await Profile.create({
        userId: String(target.id ?? target._id ?? req.params.userId),
        email: target.email ?? "",
        name: target.name ?? "",
        roleSelected: Boolean(target.roleSelected),
      }).catch(async () => Profile.findOne({ userId: req.params.userId }).select("-__v").lean());
    }
    if (!doc) {
      // Profile-only fallback (auth DB unavailable): synthesize from legacy doc.
      const { role, ...rest } = target ?? {};
      void role;
      return ok(res, { ...rest, userId: String(req.params.userId), role: normalizeRole((target as any)?.role), roleSelected: Boolean((target as any)?.roleSelected) });
    }
    const { role, ...rest } = doc;
    void role; // legacy profile.role is never trusted
    const u = target ?? { role: undefined, roleSelected: (doc as any).roleSelected };
    const uid = String((doc as any).userId ?? req.params.userId);
    const [publishedVideos, examCount, followers, ratingAgg] = await Promise.all([
      Video.countDocuments({ ownerId: uid, status: "published" }).catch(() => 0),
      Exam.countDocuments({ ownerId: uid }).catch(() => 0),
      Follow.countDocuments({ teacherId: uid }).catch(() => 0),
      Rating.aggregate([
        { $match: { targetType: "teacher", targetId: uid } },
        { $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } },
      ]).catch(() => []),
    ]);
    const rating = Array.isArray(ratingAgg) && ratingAgg.length ? ratingAgg[0] : null;
    ok(res, {
      ...rest,
      userId: uid,
      email: (target as any)?.email ?? (doc as any).email,
      name: (target as any)?.name ?? (doc as any).name ?? "",
      emailVerified: Boolean((target as any)?.emailVerified),
      role: normalizeRole((u as any)?.role),
      roleSelected: Boolean((u as any)?.roleSelected ?? (doc as any).roleSelected),
      stats: {
        publishedVideos,
        createdTests: examCount,
        followers,
        averageRating: rating ? Math.round(Number(rating.avg) * 10) / 10 : null,
        ratingCount: rating ? Number(rating.count) : 0,
      },
    });
  }));
  r.patch("/users/:userId/status", validate(z.object({ status: z.enum(["active", "suspended"]), reason })), asyncHandler(async (req, res) => {
    const target = await findUserByUserId(deps.authDb, String(req.params.userId));
    let doc: any = await Profile.findOne({ userId: req.params.userId });
    if (!target && !doc) throw notFound();
    if (normalizeRole((target as any)?.role) === "admin" && req.user!.id !== String(req.params.userId)) throw forbidden("Cannot suspend another admin via this endpoint");
    if (!doc) {
      doc = new Profile({
        userId: String((target as any)?.id ?? (target as any)?._id ?? req.params.userId),
        email: (target as any)?.email ?? "",
        name: (target as any)?.name ?? "",
        roleSelected: Boolean((target as any)?.roleSelected),
      });
    }
    doc.status = req.body.status; doc.suspensionReason = req.body.reason; await doc.save();
    await audit(req.user!.id, `user.status.${req.body.status}`, "user", doc.userId, req.requestId, req.body.reason);
    ok(res, { userId: doc.userId, status: doc.status });
  }));
  r.patch("/users/:userId/role", validate(z.object({ role: z.enum(["student", "teacher"]), reason })), asyncHandler(async (req, res) => {
    // Deliberately cannot create admins — admin bootstrap is a separate CLI process.
    // The `user` collection owns the role; the profile only mirrors roleSelected.
    const target = await findUserByUserId(deps.authDb, String(req.params.userId));
    let doc: any = await Profile.findOne({ userId: req.params.userId });
    if (!target && !doc) throw notFound();
    if (normalizeRole((target as any)?.role) === "admin") throw forbidden("Admin role cannot be changed via this endpoint");
    await deps.authDb?.()?.collection("user").updateOne(
      { id: String(req.params.userId) },
      { $set: { role: req.body.role, roleSelected: true } },
    );
    if (!doc) {
      doc = new Profile({
        userId: String((target as any)?.id ?? (target as any)?._id ?? req.params.userId),
        email: (target as any)?.email ?? "",
        name: (target as any)?.name ?? "",
        status: "active",
      });
    }
    doc.roleSelected = true;
    if (doc.role !== undefined) doc.set("role", undefined, { strict: false });
    await doc.save().catch(() => undefined);
    await Profile.updateOne({ userId: req.params.userId }, { $set: { roleSelected: true }, $unset: { role: "" } }).catch(() => undefined);
    await audit(req.user!.id, "user.role.change", "user", doc.userId, req.requestId, req.body.reason);
    ok(res, { userId: doc.userId, role: req.body.role });
  }));
  r.get("/content/reports", validate(pagination, "query"), asyncHandler(async (req, res) => {
    const { skip, limit } = paginate(q(req));
    const [items, total] = await Promise.all([Report.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Report.countDocuments()]);
    ok(res, { items, total });
  }));
  // Admin preview of a reported content item: bypasses paid/visibility gates
  // (public content routes would 403/404 for paid or private items). User
  // targets (teacher/user) are handled by GET /admin/users/:userId instead.
  r.get("/content/:contentType/:contentId", asyncHandler(async (req, res) => {
    const contentType = String(req.params.contentType);
    const contentId = String(req.params.contentId);
    const Model = CONTENT_MODELS[contentType];
    if (!Model) throw notFound("Unknown content type");
    const doc: any = await Model.findById(contentId).lean().catch(() => null);
    if (!doc) throw notFound();
    const ownerId = String(doc.ownerId ?? doc.authorId ?? "");
    const [ownerUser, ownerProfile, reportCount, recentReports] = await Promise.all([
      ownerId ? findUserByUserId(deps.authDb, ownerId).catch(() => null) : Promise.resolve(null),
      ownerId ? Profile.findOne({ userId: ownerId }).select("userId email name status").lean().catch(() => null) : Promise.resolve(null),
      Report.countDocuments({ targetType: contentType, targetId: contentId }).catch(() => 0),
      Report.find({ targetType: contentType, targetId: contentId }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    ]);
    ok(res, {
      doc,
      owner: ownerId
        ? {
            userId: ownerId,
            email: (ownerUser as any)?.email ?? (ownerProfile as any)?.email ?? "",
            name: (ownerUser as any)?.name ?? (ownerProfile as any)?.name ?? "",
            status: (ownerProfile as any)?.status ?? "active",
          }
        : null,
      reportCount,
      recentReports,
    });
  }));
  r.patch("/content/:contentType/:contentId/moderation", validate(z.object({ action: z.enum(["hide", "restore", "reject"]), reason })), asyncHandler(async (req, res) => {
    const Model = CONTENT_MODELS[String(req.params.contentType)]; if (!Model) throw notFound("Unknown content type");
    const doc: any = await Model.findById(String(req.params.contentId)); if (!doc) throw notFound();
    if (Model === Comment) doc.moderationState = req.body.action === "restore" ? "visible" : "hidden";
    else doc.status = req.body.action === "restore" ? "published" : req.body.action === "reject" ? "rejected" : "hidden";
    await doc.save();
    await audit(req.user!.id, `content.moderation.${req.body.action}`, String(req.params.contentType), String(req.params.contentId), req.requestId, req.body.reason);
    ok(res, { id: doc.id, action: req.body.action });
  }));
  r.get("/payments", validate(pagination.extend({ userId: z.string().max(100).optional(), tranId: z.string().max(100).optional() }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const filter: any = {};
    if (query.status && ["pending", "paid", "failed", "cancelled", "expired", "risk_hold", "refunded"].includes(query.status)) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    if (query.tranId) filter.tranId = { $regex: String(query.tranId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [items, total] = await Promise.all([Purchase.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Purchase.countDocuments(filter)]);
    ok(res, { items, total });
  }));
  r.get("/purchases/:purchaseId", asyncHandler(async (req, res) => {
    const doc: any = await Purchase.findById(req.params.purchaseId).lean(); if (!doc) throw notFound();
    const entitlement = await Entitlement.findOne({ sourcePurchaseId: String(doc._id) }).lean();
    // Resolve the content owner (teacher) for the details view.
    const Model = CONTENT_MODELS[String(doc.contentType)];
    const contentDoc: any = Model
      ? await Model.findById(String(doc.contentId)).select("ownerId title").lean().catch(() => null)
      : null;
    const content = {
      contentType: String(doc.contentType),
      contentId: String(doc.contentId),
      title: contentDoc?.title ?? "",
      teacherId: contentDoc?.ownerId ? String(contentDoc.ownerId) : "",
    };
    ok(res, { purchase: doc, entitlement, content }); // verified gateway fields only; admins cannot rewrite them here
  }));
  // Manual repair for a gateway-VALID order stuck in pending (e.g. the
  // pre-fix USD→BDT conversion bug where `amount` held BDT settlement while
  // the order held USD). Admin-only, audited, idempotent: flips a
  // pending/risk_hold order to paid and grants the entitlement once. This is
  // what unlocks the student's video. The teacher's money stays "pending"
  // (due payout) until a manual payout is recorded via POST /payouts/:teacherId.
  r.post("/purchases/:purchaseId/mark-paid", validate(z.object({ reason: z.string().min(3).max(500) })), asyncHandler(async (req, res) => {
    const doc: any = await Purchase.findById(req.params.purchaseId); if (!doc) throw notFound();
    if (doc.status === "paid") {
      const entitlement = await Entitlement.findOne({ sourcePurchaseId: String(doc._id) }).lean();
      if (!entitlement) {
        await Entitlement.updateOne(
          { userId: doc.userId, contentType: doc.contentType, contentId: doc.contentId, sourcePurchaseId: String(doc._id) },
          { $setOnInsert: { grantedAt: new Date(), active: true } }, { upsert: true });
      }
      return ok(res, { purchase: await Purchase.findById(doc._id).lean(), repaired: false });
    }
    if (!["pending", "risk_hold"].includes(doc.status)) throw badRequest(`Only pending/risk_hold orders can be marked paid (current: ${doc.status}).`);
    const updated = await Purchase.findOneAndUpdate(
      { _id: doc._id, status: { $in: ["pending", "risk_hold"] } },
      { $set: { status: "paid" }, $push: { statusHistory: { status: "paid", source: `admin_mark_paid:${req.user!.id}` } } },
      { returnDocument: "after" });
    await Entitlement.updateOne(
      { userId: doc.userId, contentType: doc.contentType, contentId: doc.contentId, sourcePurchaseId: String(doc._id) },
      { $setOnInsert: { grantedAt: new Date(), active: true } }, { upsert: true }); // unique index prevents duplicates
    await audit(req.user!.id, "purchase.mark_paid", "purchase", String(doc._id), req.requestId, `${req.body.reason} (tranId ${doc.tranId})`);
    ok(res, { purchase: updated, repaired: true });
  }));

  // ---- Teacher payouts -------------------------------------------------
  // Total earned = sum of PAID purchases of content the teacher owns.
  // Due payout = total earned − payouts already recorded by admins.
  const OWNED_MODELS: [string, any][] = [["video", Video], ["playlist", Playlist], ["question", Question], ["exam", Exam]];
  async function teacherFinances(teacherIds: string[]) {
    const earned = new Map<string, { total: number; sales: number }>();
    const paidOut = new Map<string, number>();
    if (!teacherIds.length) return { earned, paidOut };
    const ownerByContent = new Map<string, string>();
    await Promise.all(OWNED_MODELS.map(async ([type, Model]) => {
      const docs: any[] = await Model.find({ ownerId: { $in: teacherIds } }).select("_id ownerId").lean().catch(() => []);
      for (const d of docs) ownerByContent.set(`${type}:${String(d._id)}`, String(d.ownerId));
    }));
    if (ownerByContent.size) {
      const agg: any[] = await Purchase.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: { t: "$contentType", id: "$contentId" }, total: { $sum: "$amount" }, sales: { $sum: 1 } } },
      ]).catch(() => []);
      for (const row of agg) {
        const teacherId = ownerByContent.get(`${row._id.t}:${String(row._id.id)}`);
        if (!teacherId) continue;
        const cur = earned.get(teacherId) ?? { total: 0, sales: 0 };
        cur.total += Number(row.total) || 0;
        cur.sales += Number(row.sales) || 0;
        earned.set(teacherId, cur);
      }
    }
    const pAgg: any[] = await Payout.aggregate([
      { $match: { teacherId: { $in: teacherIds } } },
      { $group: { _id: "$teacherId", total: { $sum: "$amount" } } },
    ]).catch(() => []);
    for (const row of pAgg) paidOut.set(String(row._id), Number(row.total) || 0);
    return { earned, paidOut };
  }
  const payoutRow = async (t: { teacherId: string; name: string; email: string }, fin: Awaited<ReturnType<typeof teacherFinances>>) => {
    const e = fin.earned.get(t.teacherId) ?? { total: 0, sales: 0 };
    const paid = fin.paidOut.get(t.teacherId) ?? 0;
    const profile: any = await Profile.findOne({ userId: t.teacherId }).select("payout").lean().catch(() => null);
    const p = profile?.payout ?? {};
    return {
      teacherId: t.teacherId, name: t.name, email: t.email,
      totalEarned: Math.round(e.total * 100) / 100, salesCount: e.sales,
      totalPaidOut: Math.round(paid * 100) / 100,
      duePayout: Math.round((e.total - paid) * 100) / 100,
      currency: "USD",
      payout: {
        accountType: String(p.accountType ?? ""),
        holderName: String(p.holderName ?? ""),
        bankName: String(p.bankName ?? ""),
        accountNumber: String(p.accountNumber ?? ""),
        branchName: String(p.branchName ?? ""),
        routingNumber: String(p.routingNumber ?? ""),
        provider: String(p.provider ?? ""),
        mobileNumber: String(p.mobileNumber ?? ""),
      },
    };
  };
  async function listTeachers(): Promise<{ teacherId: string; name: string; email: string }[]> {
    const userCol = deps.authDb?.()?.collection("user");
    if (userCol) {
      const docs: any[] = await userCol.find({ role: "teacher" }).project({ id: 1, name: 1, email: 1 }).toArray().catch(() => []);
      return docs.map((d: any) => ({ teacherId: String(d.id ?? d._id), name: String(d.name ?? ""), email: String(d.email ?? "") }));
    }
    const ids = await listUserIdsByRole(deps.authDb, "teacher");
    const profiles: any[] = ids.length ? await Profile.find({ userId: { $in: ids } }).select("userId name email").lean().catch(() => []) : [];
    return profiles.map((p: any) => ({ teacherId: String(p.userId), name: String(p.name ?? ""), email: String(p.email ?? "") }));
  }
  r.get("/payouts", asyncHandler(async (_req, res) => {
    const teachers = await listTeachers();
    const fin = await teacherFinances(teachers.map((t) => t.teacherId));
    const items = (await Promise.all(teachers.map((t) => payoutRow(t, fin)))).sort((a, b) => b.duePayout - a.duePayout);
    ok(res, { items, total: items.length });
  }));
  r.get("/payouts/:teacherId", asyncHandler(async (req, res) => {
    const teacherId = String(req.params.teacherId);
    const target = await findUserByUserId(deps.authDb, teacherId);
    const profile: any = !target ? await Profile.findOne({ userId: teacherId }).select("userId name email").lean().catch(() => null) : null;
    if (!target && !profile) throw notFound("Teacher not found");
    if (target && normalizeRole(target.role) !== "teacher") throw notFound("Teacher not found");
    const fin = await teacherFinances([teacherId]);
    const history: any[] = await Payout.find({ teacherId }).sort({ createdAt: -1 }).limit(100).lean().catch(() => []);
    ok(res, {
      teacher: await payoutRow({
        teacherId,
        name: String(target?.name ?? profile?.name ?? ""),
        email: String(target?.email ?? profile?.email ?? ""),
      }, fin),
      history: history.map((p: any) => ({
        id: String(p._id), amount: p.amount, currency: p.currency ?? "USD",
        note: p.note ?? "", createdBy: p.createdBy, createdAt: p.createdAt ?? null,
      })),
    });
  }));
  // Serialize payout recording per teacher so concurrent requests cannot
  // both pass the due check and overpay (single-process lock; the due amount
  // is recomputed inside the lock).
  const payoutLocks = new Map<string, Promise<unknown>>();
  const withPayoutLock = <T,>(teacherId: string, fn: () => Promise<T>): Promise<T> => {
    const prev = payoutLocks.get(teacherId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    payoutLocks.set(teacherId, run.catch(() => undefined));
    return run;
  };
  r.post("/payouts/:teacherId", validate(z.object({
    amount: z.number().positive().max(1_000_000_000),
    note: z.string().max(500).optional().default(""),
  })), asyncHandler(async (req, res) => {
    const teacherId = String(req.params.teacherId);
    const target = await findUserByUserId(deps.authDb, teacherId);
    const profile: any = !target ? await Profile.findOne({ userId: teacherId }).select("userId").lean().catch(() => null) : null;
    if (!target && !profile) throw notFound("Teacher not found");
    if (target && normalizeRole(target.role) !== "teacher") throw notFound("Teacher not found");
    const result = await withPayoutLock(teacherId, async () => {
      const fin = await teacherFinances([teacherId]);
      const e = fin.earned.get(teacherId) ?? { total: 0, sales: 0 };
      const due = Math.round((e.total - (fin.paidOut.get(teacherId) ?? 0)) * 100) / 100;
      const amount = Math.round(Number(req.body.amount) * 100) / 100;
      if (amount > due) throw badRequest(`Amount exceeds due payout (${due}).`);
      const doc: any = await Payout.create({ teacherId, amount, currency: "USD", note: String(req.body.note ?? ""), createdBy: req.user!.id });
      return { id: String(doc._id), amount, dueAfter: Math.round((due - amount) * 100) / 100 };
    });
    await audit(req.user!.id, "payout.record", "user", teacherId, req.requestId, `Paid ${result.amount} USD${req.body.note ? `: ${req.body.note}` : ""}`);
    ok(res, { id: result.id, teacherId, amount: result.amount, duePayout: result.dueAfter }, 201);
  }));
  r.get("/analytics", validate(z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const to = query.to ? new Date(query.to) : new Date(); const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400000);
    if (to.getTime() - from.getTime() > 366 * 86400000) throw forbidden("Date range too large (max 366 days)");
    const dateFilter = { createdAt: { $gte: from, $lte: to } };
    // New-user counts come from the `user` collection (profiles hold no role).
    const userCol = deps.authDb?.()?.collection("user");
    const [newUsers, revenueAgg, purchasesByStatus] = await Promise.all([
      userCol ? userCol.countDocuments(dateFilter) : Profile.countDocuments(dateFilter),
      Purchase.aggregate([{ $match: { ...dateFilter, status: "paid" } }, { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Purchase.aggregate([{ $match: dateFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    ok(res, { from, to, newUsers, revenue: revenueAgg, purchasesByStatus }); // aggregated only
  }));
  r.get("/audit-logs", validate(pagination.extend({ actorId: z.string().max(100).optional(), action: z.string().max(100).optional() }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const filter: any = {}; if (query.actorId) filter.actorId = query.actorId; if (query.action) filter.action = query.action;
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
    ok(res, { items, total });
  }));
  return r;
}
