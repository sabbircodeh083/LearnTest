"use client";
import { use } from "react";
import { ContentForm, type ContentInitial } from "@/components/ContentForm";
import { ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { QuizForm, type QuizFormInitial } from "../../new/quiz/form";
import { AssignmentProjectForm, type AssignmentProjectFormInitial } from "./assignment-form";
import { WrittenForm, type WrittenFormInitial } from "../../new/written/form";
import { ProblemForm, type ProblemFormInitial } from "../../new/problem/form";
import { ProjectForm, type ProjectFormInitial } from "../../new/project/form";

interface ExamDoc {
  _id: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
  status?: string;
  price?: number;
  currency?: string;
  playlistId?: string | null;
  videoId?: string;
  durationMinutes?: number;
  maxAttempts?: number | null;
  accessPolicy?: string;
  passingMarks?: number;
  endsAt?: string | null;
  kind?: string;
  questionIds?: string[];
  maxScore?: number;
  submissionTypes?: string[];
  maxFileSize?: string;
  maxFiles?: number;
  rubric?: unknown;
}

interface QDoc {
  _id: string;
  title?: string;
  description?: string;
  prompt?: string;
  rubric?: string;
  type?: string;
  options?: string[];
  correctOptions?: number[];
  multiple?: boolean;
  marks?: number;
  explanation?: string;
}

type Loaded =
  | { source: "assignment"; assignment: Record<string, unknown> }
  | { source: "exam"; kind: string; exam: ExamDoc; questions: QDoc[] };

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KIND_LABEL_TO_WRITTEN: Record<string, "short" | "long" | "essay"> = {
  "Short Answer": "short",
  "Long Answer": "long",
  "Essay": "essay",
};

const PROJECT_SUBS = ["zip", "git", "live", "pdf"] as const;
type SubType = (typeof PROJECT_SUBS)[number];
const isSubType = (s: string): s is SubType => (PROJECT_SUBS as readonly string[]).includes(s);

function parseSlotType(q: QDoc): SubType | null {
  const first = String(q.rubric ?? "").split("\n")[0]?.trim() ?? "";
  const m = /^submissionType:(zip|git|live|pdf)$/.exec(first);
  if (m) return m[1] as SubType;
  const t = String(q.title ?? "");
  if (t.startsWith("ZIP File")) return "zip";
  if (t.startsWith("Git Repository Link")) return "git";
  if (t.startsWith("Live Link")) return "live";
  if (t.startsWith("PDF File")) return "pdf";
  return null;
}

function parseCriteriaFromText(text: string): { label: string; marks: string }[] {
  const lines = String(text ?? "").split("\n");
  const start = lines.findIndex((l) => /mark distribution/i.test(l));
  if (start === -1) return [];
  const out: { label: string; marks: string }[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^-\s*(.+?)\s*:\s*([\d.]+)\s*$/.exec(l.trim());
    if (m) out.push({ label: m[1]!.trim(), marks: m[2]!.trim() });
  }
  return out;
}

function parseCriteriaFromSlots(qs: QDoc[]): { label: string; marks: string }[] {
  for (const q of qs) {
    const parsed = parseCriteriaFromText(String(q.rubric ?? ""));
    if (parsed.length) return parsed;
  }
  return [];
}

function defaultCriteria(totalRaw: string): { label: string; marks: string }[] {
  const total = Number(totalRaw) || 100;
  const base = [
    { label: "Functionality", marks: 30 },
    { label: "Code Quality", marks: 20 },
    { label: "UI/UX", marks: 20 },
    { label: "Documentation", marks: 20 },
    { label: "Best Practices", marks: 10 },
  ];
  const scaled = base.map((c) => ({ label: c.label, marks: String(Math.round((c.marks * total) / 100)) }));
  const diff = total - scaled.reduce((s, c) => s + Number(c.marks || 0), 0);
  if (scaled.length) scaled[scaled.length - 1]!.marks = String(Number(scaled[scaled.length - 1]!.marks || 0) + diff);
  return scaled;
}

function parsePackedProject(desc: string) {
  const text = String(desc ?? "");
  const instructions = text.includes("Project instructions:")
    ? text.split("Project instructions:").slice(1).join("Project instructions:").split(/\n\s*Mark distribution/i)[0]?.trim() ?? ""
    : "";
  const criteria = parseCriteriaFromText(text);
  const subLine = /Allowed submissions:\s*([^\n·]+)/i.exec(text)?.[1] ?? "";
  const subTypes: SubType[] = [];
  if (/ZIP/i.test(subLine)) subTypes.push("zip");
  if (/Git Link/i.test(subLine)) subTypes.push("git");
  if (/Live Link/i.test(subLine)) subTypes.push("live");
  if (/PDF/i.test(subLine)) subTypes.push("pdf");
  const maxFileSize = /Max file size\s*([^·\n]+)/i.exec(text)?.[1]?.trim() ?? "";
  const maxFiles = /Max files\s*(\d+)/i.exec(text)?.[1] ?? "";
  const passing = /Passing\s*([\d.]+)\s*\/\s*([\d.]+)/i.exec(text);
  return {
    instructions,
    criteria,
    subTypes,
    maxFileSize,
    maxFiles,
    passingMarks: passing?.[1] ?? "",
    totalMarks: passing?.[2] ?? "",
  };
}

function parseProblemQ(q: QDoc) {
  const promptLines = String(q.prompt ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const rubric = String(q.rubric ?? "").trim();
  const url = /^https?:\/\//.test(rubric) ? rubric : (promptLines.find((l) => /^https?:\/\//.test(l)) ?? "");
  let name = promptLines[0] ?? "";
  if (/^https?:\/\//.test(name)) name = String(q.title ?? "");
  const extra = promptLines.filter((l) => l !== promptLines[0] && l !== url).join("\n");
  return { name, url, extra };
}

export default function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useFetch(async (): Promise<Loaded> => {
    let exam: ExamDoc;
    try {
      exam = await apiGet<ExamDoc>(`/api/v1/exams/${id}`);
    } catch (e) {
      // Legacy project tests live in Assignments — same generic edit form, other endpoint.
      if (e instanceof ApiError && e.status === 404) {
        const assignment = await apiGet<Record<string, unknown>>(`/api/v1/assignments/${id}`);
        return { source: "assignment", assignment } as const;
      }
      throw e;
    }
    const qids = (exam.questionIds ?? []).map(String);
    const questions: QDoc[] = [];
    for (const qid of qids.slice(0, 200)) {
      try {
        questions.push(await apiGet<QDoc>(`/api/v1/questions/${qid}`));
      } catch {
        // Dead link — dropped from the order on save (the backend rejects
        // unknown IDs, so keeping them would block every update).
      }
    }
    return { source: "exam", kind: exam.kind ?? "quiz", exam, questions } as const;
  }, [id]);

  if (loading) return <div><PageHead title="Edit test" sub="Loading…" /><Loading label="Loading test…" /></div>;
  if (error || !data) return <div><PageHead title="Edit test" sub="" /><ErrorBox message={error ?? "Test not found."} onRetry={retry} /></div>;

  if (data.source === "assignment") {
    const a = data.assignment as {
      _id?: unknown; title?: unknown; description?: unknown; tags?: unknown;
      visibility?: unknown; status?: unknown; price?: unknown; videoId?: unknown;
      dueAt?: unknown; maxScore?: unknown; maxAttempts?: unknown; passingMarks?: unknown;
      playlistId?: unknown; maxFileSize?: unknown; maxFiles?: unknown;
      submissionTypes?: unknown; rubric?: unknown;
    };
    const dueRaw = typeof a.dueAt === "string" ? a.dueAt : "";
    const rawSubTypes = Array.isArray(a.submissionTypes) ? a.submissionTypes.map(String) : [];
    const validSubs = ["zip", "git", "live", "pdf"] as const;
    const rawCriteria = Array.isArray(a.rubric) ? a.rubric : [];
    const storedCriteria = rawCriteria
      .map((c: unknown) => {
        const r = c as { label?: unknown; marks?: unknown };
        return { label: String(r?.label ?? ""), marks: String(r?.marks ?? "") };
      })
      .filter((c) => c.label || c.marks);
    const packed = parsePackedProject(String(a.description ?? ""));
    const recoveredCriteria = storedCriteria.length ? storedCriteria : packed.criteria;
    const maxScoreRaw = String(a.maxScore ?? 100);
    const criteria = recoveredCriteria.length ? recoveredCriteria : defaultCriteria(maxScoreRaw);
    const storedSubs = rawSubTypes.filter((s): s is (typeof validSubs)[number] =>
      (validSubs as readonly string[]).includes(s));
    const storedPassing = a.passingMarks != null ? String(a.passingMarks) : "";
    const initial: AssignmentProjectFormInitial = {
      assignmentId: String(a._id ?? id),
      title: String(a.title ?? ""),
      description: String(a.description ?? ""),
      tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
      pricing: Number(a.price ?? 0) > 0 ? "paid" : "free",
      price: String(a.price ?? ""),
      visibility: String(a.visibility ?? "public"),
      status: String(a.status ?? "draft"),
      videoId: String(a.videoId ?? ""),
      dueAt: toLocalInput(dueRaw),
      maxScore: maxScoreRaw,
      maxAttempts: a.maxAttempts == null ? "unlimited" : String(a.maxAttempts),
      passingMarks: storedPassing && storedPassing !== "0" ? storedPassing : (packed.passingMarks || String(Math.round((Number(maxScoreRaw) || 100) * 0.6))),
      playlistId: String(a.playlistId ?? ""),
      maxFileSize: String(a.maxFileSize || packed.maxFileSize || "50 MB"),
      maxFiles: String(a.maxFiles ?? (packed.maxFiles || 1)),
      subTypes: storedSubs.length ? storedSubs : (packed.subTypes.length ? packed.subTypes : ["zip", "git", "live", "pdf"]),
      criteria,
    };
    return <AssignmentProjectForm initial={initial} />;
  }

  const exam = data.exam;
  const qs = data.questions;
  const pricing = (Number(exam.price) || 0) > 0 ? "paid" as const : "free" as const;
  const base = {
    examId: String(exam._id),
    title: String(exam.title ?? ""),
    playlistId: String(exam.playlistId ?? ""),
    description: String(exam.description ?? ""),
    tags: Array.isArray(exam.tags) ? exam.tags.map(String) : [],
    pricing,
    price: String(exam.price ?? ""),
    passingMarks: exam.passingMarks != null ? String(exam.passingMarks) : "",
    attempts: exam.maxAttempts == null ? "unlimited" : String(exam.maxAttempts),
    visibility: String(exam.visibility ?? "public"),
    status: String(exam.status ?? "draft"),
    videoId: String(exam.videoId ?? ""),
    deadline: toLocalInput(exam.endsAt),
  };

  if (data.kind === "quiz") {
    const initial: QuizFormInitial = {
      ...base,
      timeLimit: String(exam.durationMinutes ?? 15),
      questions: qs.map((q) => ({
        qid: String(q._id),
        text: String(q.prompt ?? q.title ?? ""),
        mode: q.multiple ? "multiple" as const : "single" as const,
        marks: String(q.marks ?? 1),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correct: Array.isArray(q.correctOptions) ? q.correctOptions.map(Number) : [],
        explanation: String(q.explanation ?? ""),
      })),
    };
    return <QuizForm initial={initial} />;
  }

  if (data.kind === "written") {
    const total = qs.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    const initial: WrittenFormInitial = {
      ...base,
      totalMarks: String(total || ""),
      questions: qs.map((q) => ({
        qid: String(q._id),
        kind: KIND_LABEL_TO_WRITTEN[String(q.description ?? "")] ?? "short",
        text: String(q.prompt ?? q.title ?? ""),
        marks: String(q.marks ?? 0),
      })),
    };
    return <WrittenForm initial={initial} />;
  }

  if (data.kind === "problem") {
    const individuals = qs.filter((q) => String(q.description ?? "") !== "Problem list");
    const lists = qs.filter((q) => String(q.description ?? "") === "Problem list");
    const initial: ProblemFormInitial = {
      ...base,
      mode: individuals.length === 0 && lists.length > 0 ? "list" : "individual",
      problems: individuals.map((q) => {
        const p = parseProblemQ(q);
        return { qid: String(q._id), name: p.name, url: p.url, extra: p.extra, topics: [] };
      }),
      lists: lists.map((q) => {
        const p = parseProblemQ(q);
        return { qid: String(q._id), name: p.name, url: p.url, extra: p.extra, topics: [] };
      }),
      totalMarks: String(qs.reduce((s, q) => s + (Number(q.marks) || 0), 0) || ""),
    };
    return <ProblemForm initial={initial} />;
  }

  if (data.kind === "project") {
    const slotQids: Partial<Record<SubType, string>> = {};
    for (const q of qs) {
      const st = parseSlotType(q);
      if (st && !slotQids[st]) slotQids[st] = String(q._id);
    }
    const firstPrompt = String(qs[0]?.prompt ?? "");
    const markerPrompt = firstPrompt.includes("Project instructions:")
      ? firstPrompt
      : (qs.map((q) => String(q.prompt ?? "")).find((p) => p.includes("Project instructions:")) ?? "");
    const packed = parsePackedProject(String(exam.description ?? ""));
    const instructions = markerPrompt
      ? markerPrompt.split("Project instructions:").slice(1).join("Project instructions:").trim()
      : packed.instructions;
    const rawCriteria = Array.isArray(exam.rubric) ? exam.rubric : [];
    const examCriteria = rawCriteria
      .map((c: unknown) => {
        const r = c as { label?: unknown; marks?: unknown };
        return { label: String(r?.label ?? ""), marks: String(r?.marks ?? "") };
      })
      .filter((c) => c.label || c.marks);
    // Fall back to criteria embedded in slot rubrics, then to the packed
    // description, when the exam-level rubric is missing (older records).
    const slotCriteria = parseCriteriaFromSlots(qs);
    const criteria = examCriteria.length ? examCriteria : (slotCriteria.length ? slotCriteria : packed.criteria);
    const examSubs = Array.isArray(exam.submissionTypes) ? exam.submissionTypes.filter(isSubType) : [];
    const slotSubs = (Object.keys(slotQids) as SubType[]).filter((s) => !examSubs.includes(s));
    const orderedSubs = examSubs.length || slotSubs.length ? [...examSubs, ...slotSubs] : packed.subTypes;
    const shortDesc = String(exam.description ?? "").split("\n\nProject instructions:")[0]?.trim() ?? "";
    const totalMarksRaw = String(exam.maxScore ?? (packed.totalMarks || criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0) || 100));
    const initial: ProjectFormInitial = {
      examId: base.examId,
      title: base.title,
      playlistId: base.playlistId,
      description: shortDesc,
      tags: base.tags,
      pricing: base.pricing,
      price: base.price,
      instructions,
      criteria: criteria.length ? criteria : defaultCriteria(totalMarksRaw),
      subTypes: orderedSubs.length ? orderedSubs : (["zip", "git", "live", "pdf"] as SubType[]),
      totalMarks: totalMarksRaw,
      passingMarks: base.passingMarks || packed.passingMarks || "0",
      deadline: base.deadline,
      attempts: base.attempts,
      visibility: base.visibility,
      status: base.status,
      videoId: base.videoId,
      maxFileSize: String(exam.maxFileSize || packed.maxFileSize || "50 MB"),
      maxFiles: String(exam.maxFiles ?? (packed.maxFiles || 1)),
      slotQids,
      existingQuestionIds: qs.map((q) => String(q._id)),
    };
    return <ProjectForm initial={initial} />;
  }

  // Unknown kind — fall back to the generic exam form.
  return (
    <div>
      <PageHead title="Edit test" sub="Update every part of this test." />
      <ContentForm kind="exam" endpoint="/api/v1/exams" initial={exam as unknown as ContentInitial} backHref="/teacher/exams" />
    </div>
  );
}
