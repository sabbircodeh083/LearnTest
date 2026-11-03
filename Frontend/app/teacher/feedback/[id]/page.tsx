"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { apiBlobUrl, apiDownload, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, idOf, type Exam, type ExamAttemptRow, type Page, type Question } from "@/lib/types";

const inputCls = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted/70 shadow-[0_1px_3px_rgba(16,24,40,0.10)] outline-none focus:border-line";
const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] card-hover";
const gradeBtnCls = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50";

const KIND_META: Record<string, { label: string; box: string; icon: React.ReactNode }> = {
  written: {
    label: "Written", box: "bg-[#dbeafe] text-[#2563eb]",
    icon: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></>),
  },
  project: {
    label: "Project", box: "bg-[#ffedd5] text-[#ea580c]",
    icon: (<><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  },
};

const isUrl = (s: string) => /^https?:\/\/.+\..+/.test(s.trim());

function answerText(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw);
}

/* ---------- attached PDF (written) ---------- */
function PdfCard({ uploadId, filename }: { uploadId: string; filename: string }) {
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
    } catch { toast("This file is not available.", "err"); }
    finally { setBusy(false); }
  };
  const download = () => {
    apiDownload(`/api/v1/uploads/${uploadId}/download`, filename || "answer.pdf").catch((e) => toast(e.message, "err"));
  };
  return (
    <div className="rounded-xl border border-line bg-soft p-4">
      <p className="text-sm font-bold">📕 Submitted PDF</p>
      <p className="mt-0.5 truncate text-[13px] text-muted">{filename || "answer.pdf"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void view()} disabled={busy}
          className="rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff] disabled:opacity-50">
          {open ? "Hide PDF" : busy ? "Opening…" : "Open PDF"}
        </button>
        <button type="button" onClick={download}
          className="rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-soft">
          Download
        </button>
      </div>
      {open && url && (
        <iframe sandbox="" src={url} title="Submitted PDF" className="mt-3 h-[560px] w-full rounded-lg border border-line bg-card" />
      )}
    </div>
  );
}

/* ---------- exam (written / project) feedback ---------- */
function ExamFeedback({ examId, initialAttemptId, fromArchive }: { examId: string; initialAttemptId: string; fromArchive: boolean }) {
  const toast = useToast();
  const exam = useFetch(() => apiGet<Exam>(`/api/v1/exams/${examId}`), [examId]);
  const attempts = useFetch(() => apiGet<Page<ExamAttemptRow>>(`/api/v1/exams/${examId}/attempts${qs({ limit: 100, latest: 1, submittedOnly: 1 })}`), [examId]);
  const qids = exam.data?.questionIds ?? [];
  const qKey = qids.join(",");
  const qlist = useFetch(async () => {
    if (!qids.length) return [] as Question[];
    const mine = await apiGet<Page<Question>>(`/api/v1/questions${qs({ mine: 1, limit: 100 })}`)
      .catch(() => ({ items: [], total: 0 }) as Page<Question>);
    const byId = new Map(mine.items.map((q) => [String(q._id), q]));
    for (const qid of qids.filter((x) => !byId.has(String(x))).slice(0, 50)) {
      try {
        const one = await apiGet<Question>(`/api/v1/questions/${qid}`);
        byId.set(String(one._id), one);
      } catch { /* removed — skipped */ }
    }
    return qids.map((x) => byId.get(String(x))).filter(Boolean) as Question[];
  }, [qKey]);

  const allRows = attempts.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && allRows.length) {
      if (initialAttemptId && allRows.some((r) => String(r._id) === initialAttemptId)) setSelectedId(initialAttemptId);
      else {
        const first = fromArchive ? allRows.find((r) => r.state === "graded") : allRows.find((r) => r.state !== "graded");
        setSelectedId(first ? String(first._id) : String(allRows[0]!._id));
      }
    }
  }, [allRows, selectedId, initialAttemptId, fromArchive]);
  const selected = allRows.find((r) => String(r._id) === selectedId) ?? null;
  // Graded submissions live only in the Archive: the picker lists the current
  // context (pending work, or graded work when opened from the Archive). The
  // submission being viewed is always kept so grading can be finished.
  const rows = useMemo(() => {
    const list = fromArchive ? allRows.filter((r) => r.state === "graded") : allRows.filter((r) => r.state !== "graded");
    if (selected && !list.some((r) => String(r._id) === String(selected._id))) return [selected, ...list];
    return list;
  }, [allRows, fromArchive, selected]);

  const kind = (exam.data as { kind?: string } | undefined)?.kind ?? "written";
  const meta = KIND_META[kind] ?? KIND_META.written!;
  const questions = qlist.data ?? [];
  const answers = (selected?.answers ?? {}) as Record<string, unknown>;

  // Grading items: written → one per question; project → one per saved criterion.
  const criteria = useMemo(() => {
    const r = (exam.data as unknown as { rubric?: unknown })?.rubric;
    return Array.isArray(r) ? r.filter((c): c is { label: string; marks: number } => typeof c === "object" && c !== null) : [];
  }, [exam.data]);
  const items = useMemo(() => {
    if (kind === "project" && criteria.length) {
      return criteria.map((c, i) => ({ key: `c${i}`, label: c.label || `Criterion ${i + 1}`, max: Number(c.marks) || 0 }));
    }
    return questions.map((q) => ({ key: String(q._id), label: q.title || "Question", max: Number(q.marks ?? 1) || 0 }));
  }, [kind, criteria, questions]);

  const [marks, setMarks] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const bd = new Map((selected?.breakdown ?? []).map((b) => [b.key, b]));
    const m: Record<string, string> = {};
    const c: Record<string, string> = {};
    for (const it of items) {
      const prev = bd.get(it.key);
      m[it.key] = prev ? String(prev.marks) : "";
      c[it.key] = prev?.comment ?? "";
    }
    setMarks(m);
    setComments(c);
    setOverall(selected?.feedback ?? "");
    setError("");
  }, [selected?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = items.reduce((s, it) => s + (Number(marks[it.key]) || 0), 0);
  const maxTotal = items.reduce((s, it) => s + it.max, 0);

  const save = async () => {
    if (!selected) return;
    setError("");
    const breakdown = [];
    for (const it of items) {
      if ((marks[it.key] ?? "").trim() === "") { setError(`Marks for "${it.label}" is required — enter 0 or more.`); return; }
      const m = Number(marks[it.key]);
      if (!Number.isFinite(m) || m < 0) { setError(`Marks for "${it.label}" must be 0 or more.`); return; }
      if (it.max > 0 && m > it.max) { setError(`"${it.label}" exceeds its max of ${it.max}.`); return; }
      breakdown.push({ key: it.key, label: it.label.slice(0, 200), maxMarks: it.max, marks: m, comment: (comments[it.key] ?? "").slice(0, 5000) });
    }
    setSaving(true);
    try {
      await apiPatch(`/api/v1/exam-attempts/${selected._id}/grade`, { feedback: overall, breakdown });
      toast(`Graded — total ${breakdown.reduce((s, b) => s + b.marks, 0)} / ${maxTotal}.`);
      attempts.retry();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save grades.");
    } finally {
      setSaving(false);
    }
  };

  const pdfId = typeof answers._pdfUploadId === "string" ? answers._pdfUploadId : "";
  const pdfName = typeof answers._pdfName === "string" ? answers._pdfName : "answer.pdf";

  return (
    <>
      {/* header */}
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-xl ${meta.box}`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
        </span>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{exam.data?.title ?? "…"}</h1>
          <p className="text-sm text-muted"><span className={`mr-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${meta.box}`}>{meta.label}</span>
            {selected ? `${selected.student.name} · Attempt #${selected.attemptNumber} · ${selected.state.replace("_", " ")}` : "Pick a submission to grade."}</p>
        </div>
      </div>

      {exam.loading || attempts.loading ? <div className="mt-6"><Loading label="Loading submissions…" /></div>
        : exam.error || !exam.data ? <div className="mt-6"><ErrorBox message={exam.error ?? "Test not found."} onRetry={exam.retry} /></div>
        : attempts.error ? <div className="mt-6"><ErrorBox message={attempts.error} onRetry={attempts.retry} /></div>
        : !rows.length ? <div className="mt-6"><Empty title="No submissions yet" body="Student attempts will appear here for grading." /></div>
        : (
          <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
            {/* submission */}
            <div className="space-y-4 xl:col-span-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Student submission — current per student ({rows.length})</span>
                <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)} className={`${inputCls} font-medium`}>
                  {rows.map((r) => (
                    <option key={String(r._id)} value={String(r._id)}>
                      {r.student.name} · Attempt #{r.attemptNumber} · {r.state.replace("_", " ")}{r.state === "graded" ? ` · ${r.score ?? "—"}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {kind === "written" && pdfId && <PdfCard uploadId={pdfId} filename={pdfName} />}

              {kind === "written" ? questions.map((q, i) => {
                const text = answerText(answers[String(q._id)]);
                return (
                  <article key={String(q._id)} className={cardCls} aria-label={`Answer ${i + 1}`}>
                    <p className="text-sm font-bold">Q{i + 1}. {q.title} <span className="font-normal text-muted">({q.marks ?? 1} marks)</span></p>
                    <p className="mt-1 text-[13px] text-muted">{q.prompt}</p>
                    <div className="mt-2 rounded-lg bg-soft p-3.5">
                      <p className="text-xs font-semibold text-muted">Student answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{text.trim() || <span className="text-muted">No answer written.</span>}</p>
                    </div>
                  </article>
                );
              }) : questions.map((q, i) => {
                const raw = answers[String(q._id)];
                const text = answerText(raw).trim();
                const fileName = typeof answers[`${String(q._id)}_fileName`] === "string" ? String(answers[`${String(q._id)}_fileName`]) : "";
                return (
                  <article key={String(q._id)} className={cardCls} aria-label={`Submission ${i + 1}`}>
                    <p className="text-sm font-bold">{i + 1}. {q.title}</p>
                    {q.prompt && <p className="mt-1 text-[13px] text-muted">{q.prompt}</p>}
                    <div className="mt-2 rounded-lg bg-soft p-3.5 text-sm">
                      {!text ? <span className="text-muted">Nothing submitted for this slot.</span>
                        : fileName ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{fileName}</span>
                            <button type="button"
                              onClick={() => apiDownload(`/api/v1/uploads/${text}/download`, fileName).catch((e) => toast(e.message, "err"))}
                              className="rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] font-medium hover:bg-soft">
                              Download
                            </button>
                          </span>
                        )
                        : isUrl(text) ? <a href={text} target="_blank" rel="noreferrer" className="break-all font-medium text-[#1d6ce0] underline">{text}</a>
                        : <span className="whitespace-pre-wrap break-all">{text}</span>}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* grading sidebar */}
            <aside className="xl:sticky xl:top-20" aria-label="Grading">
              <section className={cardCls}>
                <h2 className="text-[17px] font-bold">{kind === "project" && criteria.length ? "Criteria Marks" : "Question Marks"}</h2>
                <p className="text-[13px] text-muted">
                  {kind === "project" && criteria.length ? "Marks per criterion from test creation." : "Marks and a comment per question."}
                </p>
                {error && <p role="alert" className="mt-2 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}
                <div className="mt-3 space-y-3">
                  {items.map((it) => (
                    <div key={it.key} className="rounded-lg border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold">{it.label}</p>
                        <span className="shrink-0 text-xs text-muted">/ {it.max}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-[110px_1fr] gap-2">
                        <label className="block">
                          <span className="sr-only">Marks for {it.label}</span>
                          <input type="number" min={0} max={Math.max(it.max, 0)} value={marks[it.key] ?? ""}
                            onChange={(e) => setMarks((m) => ({ ...m, [it.key]: e.target.value }))}
                            placeholder="Marks" aria-label={`Marks for ${it.label}`} className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="sr-only">Comment for {it.label}</span>
                          <input value={comments[it.key] ?? ""}
                            onChange={(e) => setComments((c) => ({ ...c, [it.key]: e.target.value }))}
                            placeholder="Comment…" aria-label={`Comment for ${it.label}`} className={inputCls} />
                        </label>
                      </div>
                    </div>
                  ))}
                  {!items.length && <p className="text-sm text-muted">No gradable items on this test.</p>}
                </div>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-medium">Overall feedback</span>
                  <textarea rows={3} value={overall} onChange={(e) => setOverall(e.target.value)}
                    placeholder="Feedback the student will see…" className={inputCls} />
                </label>
                <p className="mt-2 text-sm">Total: <span className="font-bold">{total} / {maxTotal}</span></p>
                <button type="button" onClick={() => void save()} disabled={saving || !selected}
                  className={`${gradeBtnCls} mt-3 w-full`}>
                  {saving ? "Saving…" : selected?.state === "graded" ? "Update Grade" : "Save Grade"}
                </button>
              </section>
            </aside>
          </div>
        )}
    </>
  );
}

export default function TeacherFeedbackPage() {
  return (
    <Suspense fallback={<div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8"><Loading label="Loading feedback…" /></div>}>
      <FeedbackInner />
    </Suspense>
  );
}

function FeedbackInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const attempt = search.get("attempt") ?? "";
  const from = search.get("from") ?? "";
  // Back goes where the teacher came from: test details (Student Submissions
  // tab), the Submissions queue, or the Archive.
  const back =
    from === "test"
      ? { href: `/teacher/exams/${id}?tab=submissions`, label: "Test Details" }
      : from === "archive"
        ? { href: "/teacher/archive", label: "Archive" }
        : { href: "/teacher/submissions", label: "Submissions & Feedback" };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={back.href} className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;{back.label}</Link>
      <div className="mt-2">
        <ExamFeedback examId={id} initialAttemptId={attempt} fromArchive={from === "archive"} />
      </div>
    </div>
  );
}
