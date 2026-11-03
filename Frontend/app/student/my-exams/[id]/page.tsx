"use client";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Btn, ErrorBox, Loading, Notice, PageHead, statusTone, useToast, inputCls, type BadgeTone } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { questionBadge } from "@/components/cards";
import { apiBlobUrl, apiDownload, apiGet, apiPatch, apiPost, apiUpload, ApiError } from "@/lib/api";
import { safeExternalUrl } from "@/lib/url";
import { useFetch } from "@/lib/hooks";
import { RateDialog } from "@/components/RateDialog";
import type { Exam, ExamAttempt, Question, UploadDoc } from "@/lib/types";

/* Open a submitted answer PDF from inside the attempt details page. */
function SubmittedAnswerPdf({ uploadId, filename }: { uploadId: string; filename: string }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const view = async () => {
    if (url) { setOpen((o) => !o); return; }
    setBusy(true);
    try {
      const u = await apiBlobUrl(`/api/v1/uploads/${uploadId}/download`);
      setUrl(u);
      setOpen(true);
    } catch {
      toast("This file is not available.", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void view()}
          disabled={busy}
          className="rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff] disabled:opacity-50"
        >
          {open ? "Hide PDF" : busy ? "Opening…" : "Open PDF"}
        </button>
        <button
          type="button"
          onClick={() => apiDownload(`/api/v1/uploads/${uploadId}/download`, filename || "answer.pdf").catch((e) => toast(e.message, "err"))}
          className="rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-soft"
        >
          Download
        </button>
      </div>
      {open && url && (
        <iframe sandbox="" src={url} title={`Submitted answer ${filename}`} className="mt-2 h-[480px] w-full rounded-lg border border-line bg-card" />
      )}
    </div>
  );
}

const toIndexSet = (raw: unknown, options: string[]): Set<number> | null => {
  const list = Array.isArray(raw) ? raw : [raw];
  const set = new Set<number>();
  for (const el of list) {
    if (typeof el === "number" && Number.isInteger(el) && el >= 0 && el < options.length) { set.add(el); continue; }
    if (typeof el === "string" && el.trim() !== "") {
      const n = Number(el);
      if (Number.isInteger(n) && n >= 0 && n < options.length) { set.add(n); continue; }
      const idx = options.findIndex((o) => o.trim().toLowerCase() === el.trim().toLowerCase());
      if (idx < 0) return null;
      set.add(idx);
      continue;
    }
    return null;
  }
  return set;
};

const isMcq = (q: Question) => q.type === "mcq" && (q.options?.length ?? 0) >= 2;

/** Title and prompt hold the same text (teacher form copies text into both),
 *  so showing both renders the question twice. */
const sameText = (a: unknown, b: unknown) => {
  const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const x = norm(a), y = norm(b);
  return !!x && (x === y || (y.startsWith(x) && y.length - x.length < 10) || (x.startsWith(y) && x.length - y.length < 10));
};

/** Written question card: the answer box stays hidden until the down-chevron
 *  beside the question is clicked. */
function WrittenQuestionCard({ index, title, prompt, badge, mark, answer }: {
  index: number; title: string; prompt: string;
  badge: { label: string; tone: BadgeTone };
  mark?: { marks: number; maxMarks: number };
  answer: { value: string; readOnly: boolean; rows: number; onChange: (v: string) => void };
}) {
  const [open, setOpen] = useState(answer.readOnly);
  return (
    <article className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">Q{index + 1}. {title}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        {mark && (
          <span className="text-sm font-bold text-[#16a34a]">
            {mark.marks}{mark.maxMarks > 0 ? ` / ${mark.maxMarks}` : ""} marks
          </span>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          aria-label={open ? "Hide answer box" : "Show answer box"}
          className="ml-auto rounded-lg p-1.5 text-[#1d6ce0] hover:bg-soft">
          <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <>
          {!sameText(prompt, title) && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{prompt}</p>
          )}
          <textarea rows={answer.rows} disabled={answer.readOnly}
            value={answer.value} onChange={(e) => answer.onChange(e.target.value)}
            className={`${inputCls} mt-2`} placeholder={answer.readOnly ? "No answer recorded." : "Write your answer…"} />
        </>
      )}
    </article>
  );
}

/** Written/code answer: hidden behind a down-chevron until the student opens it. */
function WrittenAnswerField({ value, readOnly, rows, onChange }: {
  value: string; readOnly: boolean; rows: number; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(readOnly);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-card px-3.5 py-2.5 text-left text-sm font-medium hover:bg-soft">
        <span>Your answer</span>
        <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 text-[#1d6ce0] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <textarea rows={rows} disabled={readOnly}
          value={value} onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} mt-2`} placeholder={readOnly ? "No answer recorded." : "Write your answer…"} />
      )}
    </div>
  );
}

type ProjectSlotKey = "zip" | "git" | "live" | "pdf";
const PROJECT_SLOT_META: Record<ProjectSlotKey, { title: string; body: string; icon: string }> = {
  zip: { title: "ZIP File", body: "Upload the compressed project folder (.zip).", icon: "🗎" },
  git: { title: "Git Repository Link", body: "Enter your GitHub, GitLab or Bitbucket repository link", icon: "🔶" },
  live: { title: "Live Link", body: "Enter your deployed project link", icon: "🔗" },
  pdf: { title: "PDF File", body: "Upload the PDF document/report (.pdf).", icon: "📕" },
};
function parseProjectSlotType(q: Question): ProjectSlotKey | null {
  const desc = String(q.description ?? "");
  const m = /Project submission slot:\s*(ZIP|Git Link|Live Link|PDF)/i.exec(desc);
  if (m) {
    const label = m[1]!.toLowerCase();
    return label === "zip" ? "zip" : label === "git link" ? "git" : label === "live link" ? "live" : "pdf";
  }
  const t = String(q.title ?? "");
  if (t.startsWith("ZIP File")) return "zip";
  if (t.startsWith("Git Repository Link")) return "git";
  if (t.startsWith("Live Link")) return "live";
  if (t.startsWith("PDF File")) return "pdf";
  return null;
}

function McqOptions({ q, selected, readOnly, onPick }: {
  q: Question; selected: Set<number>; readOnly: boolean; onPick: (idx: number) => void;
}) {
  return (
    <div className="mt-4 space-y-2" role={q.multiple ? "group" : "radiogroup"} aria-label={q.multiple ? "Select all that apply" : "Select one answer"}>
      {q.multiple && !readOnly && <p className="text-xs font-medium text-muted">Select all that apply.</p>}
      {q.options.map((opt, i) => {
        const on = selected.has(i);
        return (
          <button key={i} type="button" role={q.multiple ? "checkbox" : "radio"} aria-checked={on}
            disabled={readOnly} onClick={() => onPick(i)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${on ? "border-brand bg-brandsoft font-medium" : "border-line bg-card"} ${readOnly ? "cursor-default" : "hover:border-brand"}`}>
            <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center ${q.multiple ? "rounded-md" : "rounded-full"} border-2 ${on ? "border-brand" : "border-line"}`}>
              {on && <span className={`bg-brand ${q.multiple ? "h-2.5 w-2.5 rounded-[3px]" : "h-2.5 w-2.5 rounded-full"}`} />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function AttemptPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const fromResults = search.get("from") === "results";
  const backHref = fromResults ? "/student/graded-submissions" : "/student/submissions";
  const backLabel = fromResults ? "Results & Feedback" : "My Submissions";
  const toast = useToast();
  const { confirm } = useDialog();
  const attempt = useFetch(() => apiGet<ExamAttempt>(`/api/v1/exam-attempts/${id}`), [id]);
  const questions = useFetch(() => apiGet<{ items: Question[] }>(`/api/v1/exam-attempts/${id}/questions`), [id]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [remaining, setRemaining] = useState<string | null>(null);
  const [testRating, setTestRating] = useState(0);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  // Quiz attempts grade instantly on submit — after such a submit, giving a
  // rating sends the student to Graded Submissions instead of My Submissions.
  const [afterSubmitRateRedirect, setAfterSubmitRateRedirect] = useState(false);

  useEffect(() => {
    if (attempt.data?.answers) setAnswers({ ...(attempt.data.answers as Record<string, unknown>) });
  }, [attempt.data]);

  useEffect(() => {
    if (!attempt.data || attempt.data.state !== "in_progress") return;
    const tick = () => {
      const elapsed = Date.now() - new Date(attempt.data!.startedAt).getTime();
      setRemaining(`Started ${Math.floor(elapsed / 60000)} min ago — submit before the exam duration ends.`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [attempt.data]);

  const examId = attempt.data?.examId;
  const exam = useFetch(() => (examId ? apiGet<Exam>(`/api/v1/exams/${examId}`) : Promise.resolve(null as unknown as Exam)), [examId]);
  // Problem tests are practice-only (solved on the external judge): the Solve
  // links live in the preview details, since per-question rubrics are stripped
  // for students on the questions endpoint. Project details (criteria, slots,
  // submission types, file limits) come from the same preview endpoint.
  type ProjectDetails = {
    criteria: { label: string; marks: number }[];
    slots: { title: string; type: string }[];
    submissionTypes: string[];
    maxFileSize: string;
    maxFiles: number;
  };
  const examPreview = useFetch(() => (examId
    ? apiGet<{ details: null | { problems?: { title: string; url: string }[] } | ProjectDetails }>(`/api/v1/exams/${examId}/preview`)
    : Promise.resolve(null as unknown as { details: null | { problems?: { title: string; url: string }[] } | ProjectDetails })), [examId]);

  const pick = (qid: string, idx: number, multiple: boolean) =>
    setAnswers((s) => {
      if (!multiple) return { ...s, [qid]: idx };
      const cur = Array.isArray(s[qid])
        ? (s[qid] as unknown[]).filter((v): v is number => typeof v === "number")
        : typeof s[qid] === "number" ? [s[qid] as number] : [];
      const next = cur.includes(idx) ? cur.filter((v) => v !== idx) : [...cur, idx];
      return { ...s, [qid]: next };
    });

  const attachPdf = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const doc = await apiUpload<UploadDoc>("/api/v1/uploads/assignment", file, { relatedId: id });
      setAnswers((s) => ({ ...s, _pdfUploadId: doc._id, _pdfName: file.name }));
      toast("PDF attached. It will be sent with your submission.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "PDF upload failed.", "err");
    } finally { setUploading(false); }
  };

  // Project slots: file slots upload immediately (answer = uploadId, file name
  // kept alongside); link slots store the URL text as the answer.
  const [projectError, setProjectError] = useState("");
  // Defensive dedupe: keep the first occurrence if the API ever returns a
  // duplicate question. Must run on every render (Rules of Hooks) — placed
  // with the other hooks, before any early return below.
  const qs = useMemo(() => {
    const seen = new Set<string>();
    return (questions.data?.items ?? []).filter((q) => {
      const key = String(q._id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [questions.data]);
  const attachSlotFile = async (qid: string, file: File | undefined, acceptExt: ".zip" | ".pdf") => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(acceptExt)) {
      toast(`Only ${acceptExt} files are allowed for this field.`, "err");
      return;
    }
    setUploading(true);
    try {
      const doc = await apiUpload<UploadDoc>("/api/v1/uploads/assignment", file, { relatedId: id });
      setAnswers((s) => ({ ...s, [qid]: doc._id, [`${qid}_fileName`]: file.name }));
      toast(`${file.name} uploaded. It will be sent with your submission.`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "File upload failed.", "err");
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (exam.data?.kind === "project") {
      const items = questions.data?.items ?? [];
      const details = examPreview.data?.details as { submissionTypes?: string[] } | null | undefined;
      const types = details?.submissionTypes?.length
        ? details.submissionTypes
        : items.map((q) => parseProjectSlotType(q) ?? "");
      const missing: string[] = [];
      items.forEach((q, i) => {
        const key = types[i] as ProjectSlotKey | undefined;
        const label = key ? PROJECT_SLOT_META[key].title : q.title;
        const v = answers[q._id];
        if (typeof v !== "string" || !v.trim()) missing.push(label);
        else if ((key === "git" || key === "live") && !/^https?:\/\/.+\..+/.test(v.trim())) missing.push(`${label} (valid URL)`);
      });
      if (missing.length) {
        setProjectError(`Please complete all required fields: ${missing.join(", ")}.`);
        toast(`Missing: ${missing.join(", ")}`, "err");
        return;
      }
      setProjectError("");
    }
    // Non-project kinds: a completely blank submission must not go through
    // silently, and a partial one must say how much is unanswered.
    const itemsAll = questions.data?.items ?? [];
    const isAnswered = (v: unknown) => v !== undefined && v !== null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && v.length === 0);
    const unanswered = itemsAll.filter((q) => !isAnswered(answers[q._id])).length;
    if (exam.data?.kind !== "project" && itemsAll.length > 0 && unanswered === itemsAll.length) {
      toast("You have not answered any questions yet — answer at least one before submitting.", "err");
      return;
    }
    const partialNote = exam.data?.kind !== "project" && unanswered > 0 ? ` ${unanswered} of ${itemsAll.length} question${itemsAll.length === 1 ? "" : "s"} still unanswered.` : "";
    if (!(await confirm({ title: "Submit this attempt now?", message: `You cannot edit answers after submitting.${partialNote}`, confirmLabel: "Submit" }))) return;
    setBusy(true);
    try {
      const res = await apiPatch<ExamAttempt>(`/api/v1/exam-attempts/${id}/submit`, { answers });
      if (res.state === "graded") {
        // Instantly graded (e.g. quiz): ask for a rating first, then land in
        // Graded Submissions where the graded work now lives.
        setAfterSubmitRateRedirect(true);
        setRateOpen(true);
      } else {
        toast("Attempt submitted.");
        window.location.href = "/student/submissions";
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not submit.", "err");
    } finally { setBusy(false); }
  };

  const submitRatings = async () => {
    if (!testRating) { setRateOpen(false); return; }
    if (!examId) { toast("Could not identify this test.", "err"); return; }
    setRateBusy(true);
    try {
      await apiPost("/api/v1/ratings", { targetType: "exam", targetId: examId, value: testRating });
      toast(`Thanks — you rated this test ${testRating}/5.`);
      setRateOpen(false);
      if (afterSubmitRateRedirect) window.location.href = "/student/graded-submissions";
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save rating.", "err");
    } finally { setRateBusy(false); }
  };

  if (attempt.loading) return <Loading label="Loading your attempt…" />;
  if (attempt.error) return <ErrorBox message={attempt.error} onRetry={attempt.retry} />;
  const a = attempt.data!;
  const readOnly = a.state !== "in_progress";
  const isProblem = exam.data?.kind === "problem";
  const isWritten = exam.data?.kind === "written";
  const practiceProblems = (examPreview.data?.details as { problems?: { title: string; url: string }[] } | null | undefined)?.problems ?? [];
  const isProject = exam.data?.kind === "project";
  const projectDetails = (examPreview.data?.details && "criteria" in examPreview.data.details
    ? examPreview.data.details
    : null) as { criteria: { label: string; marks: number }[]; slots: { title: string; type: string }[]; submissionTypes: string[]; maxFileSize: string; maxFiles: number } | null;
  const examRubric = (exam.data as unknown as { rubric?: unknown } | null | undefined)?.rubric;
  const projectCriteria = projectDetails?.criteria?.length
    ? projectDetails.criteria
    : Array.isArray(examRubric)
      ? examRubric.filter((c): c is { label: string; marks: number } => typeof c === "object" && c !== null)
      : [];
  const projectSubTypes: ProjectSlotKey[] = projectDetails?.submissionTypes?.length
    ? projectDetails.submissionTypes.filter((s): s is ProjectSlotKey => s === "zip" || s === "git" || s === "live" || s === "pdf")
    : qs.map((q) => parseProjectSlotType(q)).filter((s): s is ProjectSlotKey => Boolean(s));
  const projectSlots = projectSubTypes.map((key, i) => ({ key, q: qs[i], meta: PROJECT_SLOT_META[key] })).filter((s) => s.q);
  const projectInstructions = (() => {
    for (const q of qs) {
      const prompt = String(q.prompt ?? "");
      if (prompt.includes("Project instructions:")) return prompt.split("Project instructions:").slice(1).join("Project instructions:").trim();
    }
    return "";
  })();
  // Itemized teacher marks by question/criterion key (written → per question,
  // project → per criterion). Shown inline on each matching question.
  const marksByKey = new Map((a.breakdown ?? []).map((b) => [b.key, b]));
  const breakdownTotal = (a.breakdown ?? []).reduce((s, b) => s + (b.maxMarks > 0 ? b.maxMarks : 0), 0);

  return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>
      <PageHead title={isProblem && exam.data ? exam.data.title : `Attempt #${a.attemptNumber}`}
        sub={isProblem ? "Practice session — solve the problems on the original judge. Nothing is submitted." : (remaining ?? undefined)}
        action={<Badge tone={statusTone(a.state)}>{a.state.replace("_", " ")}</Badge>} />
      {a.state === "graded" && fromResults && (
        <section className="mt-6 rounded-xl border border-line bg-card p-5" aria-label="Result and feedback">
          <h2 className="text-[15px] font-bold">Result & Feedback</h2>
          <p className="mt-2 font-display text-3xl font-bold">
            {a.score ?? "—"}
            {breakdownTotal > 0 && <span className="text-base font-semibold text-muted"> / {breakdownTotal}</span>}
          </p>
          <h3 className="mt-3 text-sm font-bold">Teacher feedback</h3>
          {a.feedback
            ? <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{a.feedback}</p>
            : <p className="mt-1 text-sm text-muted">No written feedback.</p>}
          {(a.breakdown ?? []).length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-bold">Marks breakdown</h3>
              <ul className="mt-2 space-y-2">
                {(a.breakdown ?? []).map((b, i) => (
                  <li key={`${b.key}-${i}`} className="rounded-lg border border-line px-3.5 py-2.5 text-sm">
                    <p className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{b.label || `Item ${i + 1}`}</span>
                      <span className="shrink-0 font-bold text-[#16a34a]">{b.marks}{b.maxMarks > 0 ? ` / ${b.maxMarks}` : ""}</span>
                    </p>
                    {b.comment ? <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{b.comment}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {isProblem ? (
        <section className="mt-6 rounded-xl border border-line bg-card p-5" aria-label="Problems to solve">
          <h2 className="text-[15px] font-bold">Problems to solve</h2>
          <p className="mt-1 text-sm text-muted">Open each problem on the original platform and test yourself there. Nothing is sent to your teacher and progress is not reviewed.</p>
          <div className="mt-3">
            {examPreview.loading ? <Loading label="Loading problems…" /> :
              examPreview.error ? <ErrorBox message={examPreview.error} onRetry={examPreview.retry} /> :
              !practiceProblems.length ? <Notice>No problems are attached to this test yet. Tell your teacher.</Notice> : (
                <div className="space-y-2">
                  {practiceProblems.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line p-3">
                      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{i + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-sm font-bold">{p.title}</p>
                      {safeExternalUrl(p.url) && <a href={safeExternalUrl(p.url) ?? "#"} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1d6ce0] px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110">Solve</a>}
                    </div>
                  ))}
                </div>
              )}
          </div>
          <div className="mt-4">
            <Btn variant="ghost" onClick={() => setRateOpen(true)}>★ Rate this test</Btn>
          </div>
        </section>
      ) : isProject ? (
      <>
      {a.state !== "in_progress" && <Notice>Your submission is recorded. This view shows only what you submitted.</Notice>}
      {a.state !== "in_progress" && (
        <div className="mt-3">
          <Btn variant="ghost" onClick={() => setRateOpen(true)}>★ Rate this test</Btn>
        </div>
      )}

      {!!projectCriteria.length && (
        <section className="mt-6 rounded-xl border border-line bg-card p-5" aria-label="Marking criteria">
          <h2 className="text-[15px] font-bold">Marking Criteria</h2>
          <p className="mt-0.5 text-sm text-muted">How your teacher will mark this project.</p>
          <ul className="mt-3 space-y-2">
            {projectCriteria.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-sm">
                <span className="font-semibold">{c.label}</span>
                <span className="shrink-0 text-muted">{c.marks} marks</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projectInstructions && (
        <section className="mt-4 rounded-xl border border-line bg-card p-5" aria-label="Project instructions">
          <h2 className="text-[15px] font-bold">Project Instructions</h2>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
            {projectInstructions.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => (
              <li key={i}>{l.replace(/^\d+[.)]\s*/, "")}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-line bg-card p-5" aria-label="Submit Your Project">
        <h2 className="text-[15px] font-bold">Submit Your Project</h2>
        <p className="mt-0.5 text-sm text-muted">Upload your project files or provide links as allowed by the teacher. All fields below are required.</p>
        {projectError && <p role="alert" className="mt-2 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{projectError}</p>}
        <div className="mt-3">
          {questions.loading ? <Loading label="Loading submission fields…" /> :
            questions.error ? <ErrorBox message={questions.error} onRetry={questions.retry} /> :
            !projectSlots.length ? <Notice>No submission slots are attached to this project yet. Tell your teacher.</Notice> : (
            <div className="space-y-2.5">
              {projectSlots.map(({ key, q, meta }, i) => {
                const qid = String(q!._id);
                const raw = answers[qid];
                const value = typeof raw === "string" ? raw : "";
                const fileName = typeof answers[`${qid}_fileName`] === "string" ? String(answers[`${qid}_fileName`]) : "";
                const isLink = key === "git" || key === "live";
                return (
                  <div key={qid} className="rounded-lg bg-soft p-3">
                    <p className="text-[13px] font-semibold">{meta.icon} {i + 1}. {meta.title} <span aria-hidden className="text-danger">*</span></p>
                    {isLink ? (
                      readOnly ? (
                        value ? <a href={value} target="_blank" rel="noreferrer" className="mt-1.5 block break-all text-sm font-medium text-[#1d6ce0] underline">{value}</a>
                          : <p className="mt-1.5 text-sm text-muted">No link submitted.</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted">{meta.body}</p>
                          <input value={value} onChange={(e) => setAnswers((s) => ({ ...s, [qid]: e.target.value }))} required aria-required="true"
                            placeholder={key === "git" ? "Example: https://github.com/username/project" : "Example: https://your-project.vercel.app"}
                            aria-label={`${meta.title} (required)`} className={`${inputCls} mt-1.5 bg-card`} />
                        </>
                      )
                    ) : value ? (
                      <div className="mt-1.5">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{key === "pdf" ? "📕" : "🗎"} {fileName || (key === "pdf" ? "submission.pdf" : "submission.zip")}</span>
                          {!readOnly && (
                            <button type="button" disabled={uploading}
                              onClick={() => setAnswers((s) => { const n = { ...s }; delete n[qid]; delete n[`${qid}_fileName`]; return n; })}
                              className="text-[13px] font-semibold text-danger hover:underline">Remove</button>
                          )}
                        </p>
                        {key === "pdf"
                          ? <SubmittedAnswerPdf uploadId={value} filename={fileName || "submission.pdf"} />
                          : (
                            <button type="button"
                              onClick={() => apiDownload(`/api/v1/uploads/${value}/download`, fileName || "submission.zip").catch((e) => toast(e.message, "err"))}
                              className="mt-2 rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-soft">
                              Download ZIP
                            </button>
                          )}
                      </div>
                    ) : !readOnly ? (
                      <label className="mt-1.5 block cursor-pointer rounded-lg border border-dashed border-[#93c5fd] bg-card px-3 py-3 text-center">
                        <span className="block text-sm font-semibold text-[#1d6ce0]">{uploading ? "Uploading…" : "☁ Click to upload or drag and drop"}</span>
                        <span className="block text-xs text-muted">Only {key === "zip" ? ".zip" : ".pdf"} files are allowed (Max {projectDetails?.maxFileSize || "50 MB"})</span>
                        <input type="file" accept={key === "zip" ? ".zip" : ".pdf"} required aria-required="true" aria-label={`${meta.title} (required)`} className="hidden"
                          onChange={(e) => { void attachSlotFile(qid, e.target.files?.[0], key === "zip" ? ".zip" : ".pdf"); e.target.value = ""; }} />
                      </label>
                    ) : (
                      <p className="mt-1.5 text-sm text-muted">Nothing submitted for this slot.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!readOnly && questions.data && (
          <button type="button" onClick={submit} disabled={busy || uploading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
            ➤ {busy ? "Submitting…" : "Submit Project"}
          </button>
        )}
      </section>
      </>
      ) : (
      <>
      {a.state !== "in_progress" && <Notice>Your submission is recorded. This view shows only what you submitted.</Notice>}
      {a.state !== "in_progress" && qs.length > 0 && (
        <div className="mt-3">
          <Btn variant="ghost" onClick={() => setRateOpen(true)}>★ Rate this test</Btn>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {questions.loading ? <Loading label="Loading exam questions…" /> :
          questions.error ? <ErrorBox message={questions.error} onRetry={questions.retry} /> :
          !qs.length ? <Notice>No questions are attached to this exam yet. Tell your teacher, or submit the attempt as-is if they confirm it.</Notice> :
          qs.map((q, i) => {
            const raw = answers[q._id];
            const sel = isMcq(q) ? toIndexSet(raw, q.options) ?? new Set<number>() : new Set<number>();
            const mark = a.state === "graded" && fromResults ? marksByKey.get(q._id) : undefined;
            // Written: answer box hidden until the chevron beside the question
            // is clicked (plus the PDF card below stays as before).
            if (isWritten && !isMcq(q)) {
              return (
                <WrittenQuestionCard key={q._id} index={i} title={q.title} prompt={q.prompt}
                  badge={q.multiple ? { label: "MULTIPLE", tone: questionBadge(q).tone } : questionBadge(q)}
                  mark={mark ? { marks: mark.marks, maxMarks: mark.maxMarks } : undefined}
                  answer={{
                    value: typeof raw === "string" ? raw : raw === undefined || raw === null ? "" : JSON.stringify(raw),
                    readOnly, rows: q.type === "code" ? 6 : 3,
                    onChange: (v) => setAnswers((s) => ({ ...s, [q._id]: v })),
                  }} />
              );
            }
            return (
              <article key={q._id} className="rounded-xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">Q{i + 1}. {q.title}</span>
                  <Badge tone={questionBadge(q).tone}>{q.multiple ? "MULTIPLE" : questionBadge(q).label}</Badge>
                  {mark && (
                    <span className="ml-auto text-sm font-bold text-[#16a34a]">
                      {mark.marks}{mark.maxMarks > 0 ? ` / ${mark.maxMarks}` : ""} marks
                    </span>
                  )}
                </div>
                {!sameText(q.prompt, q.title) && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{q.prompt}</p>
                )}
                {isMcq(q) ? (
                  <McqOptions q={q} selected={sel} readOnly={readOnly} onPick={(idx) => pick(q._id, idx, q.multiple)} />
                ) : (
                  <WrittenAnswerField
                    value={typeof raw === "string" ? raw : raw === undefined || raw === null ? "" : JSON.stringify(raw)}
                    readOnly={readOnly} rows={q.type === "code" ? 6 : 3}
                    onChange={(v) => setAnswers((s) => ({ ...s, [q._id]: v }))}
                  />
                )}
              </article>
            );
          })}
      </div>
      {!readOnly && questions.data && !isWritten && (
        <div className="mt-6 flex justify-end">
          <Btn onClick={submit} disabled={busy} className="shadow-lg">{busy ? "Submitting…" : "Submit"}</Btn>
        </div>
      )}
      {isWritten && (
        <section className="mt-4 rounded-xl border border-line bg-card p-5" aria-label="Answer PDF">
          <h2 className="text-[15px] font-bold">Answer PDF {readOnly ? "" : <span className="font-normal text-muted">(optional)</span>}</h2>
          <p className="mt-0.5 text-sm text-muted">Upload your handwritten or typed answers as a single PDF file.</p>
          {typeof answers._pdfUploadId === "string" && answers._pdfUploadId ? (
            <div className="mt-2">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">📕 {String(answers._pdfName ?? "answer.pdf")}</span>
                {!readOnly && (
                  <button type="button" disabled={uploading}
                    onClick={() => setAnswers((s) => { const n = { ...s }; delete n._pdfUploadId; delete n._pdfName; return n; })}
                    className="text-[13px] font-semibold text-danger hover:underline">Remove</button>
                )}
              </p>
              <SubmittedAnswerPdf uploadId={String(answers._pdfUploadId)} filename={String(answers._pdfName ?? "answer.pdf")} />
            </div>
          ) : !readOnly ? (
            <label className="mt-2 block cursor-pointer rounded-lg border border-dashed border-[#93c5fd] bg-card px-3 py-3 text-center">
              <span className="block text-sm font-semibold text-[#1d6ce0]">{uploading ? "Uploading…" : "☁ Click to upload your PDF answer file"}</span>
              <span className="block text-xs text-muted">Only .pdf files are allowed</span>
              <input type="file" accept=".pdf" disabled={uploading} className="hidden"
                onChange={(e) => { void attachPdf(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          ) : (
            <p className="mt-2 text-sm text-muted">No PDF was attached to this attempt.</p>
          )}
        </section>
      )}
      {!readOnly && questions.data && isWritten && (
        <button type="button" onClick={submit} disabled={busy || uploading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
          {busy ? "Submitting…" : "Submit"}
        </button>
      )}
      </>
      )}
      {rateOpen && (
        <RateDialog
          open
          title="Rate this test"
          sub="How was this test overall? Your rating helps teachers improve."
          value={testRating}
          busy={rateBusy}
          onPick={setTestRating}
          onClose={() => setRateOpen(false)}
          onSubmit={submitRatings}
        />
      )}
    </div>
  );
}

export default function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading your attempt…" />}>
      <AttemptPageInner params={params} />
    </Suspense>
  );
}
