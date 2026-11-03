"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { Empty, Notice, useToast } from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch, usePublicConfig } from "@/lib/hooks";
import { checkFutureDate, checkPrice, checkTags } from "@/lib/validation";
import type { Page, Playlist } from "@/lib/types";
import { currencySymbol } from "@/lib/types";

interface DraftQuestion {
  key: string;
  qid?: string; // present when editing an existing question
  text: string;
  mode: "single" | "multiple";
  marks: string;
  options: string[];
  correct: number[];
  explanation: string;
  collapsed: boolean;
}

export interface QuizEditQuestion {
  qid: string;
  text: string;
  mode: "single" | "multiple";
  marks: string;
  options: string[];
  correct: number[];
  explanation: string;
}

export interface QuizFormInitial {
  examId: string;
  title: string;
  playlistId: string;
  description: string;
  tags: string[];
  pricing: "free" | "paid";
  price: string;
  passingMarks: string;
  timeLimit: string;
  attempts: string;
  visibility: string;
  status: string;
  videoId: string;
  questions: QuizEditQuestion[];
}

const inputCls =
  "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand";

function Label({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-medium">
      {children} {required && <span aria-hidden className="text-danger">*</span>}
      {optional && <span className="font-normal text-muted"> (Optional)</span>}
    </span>
  );
}

function TagsInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className={`${inputCls} flex flex-wrap items-center gap-2 !py-2`}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-md bg-soft px-2.5 py-1 text-sm font-medium">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted hover:text-danger">×</button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const t = draft.trim().replace(/,+$/, "");
            if (t && !value.includes(t) && value.length < 20) onChange([...value, t]);
            setDraft("");
          }
        }}
        placeholder={value.length ? "Add tags and press Enter..." : "Add tags and press Enter..."}
        aria-label="Add tags and press Enter" className="min-w-[180px] flex-1 bg-transparent outline-none placeholder:text-muted/70" />
    </div>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`rounded-md p-1.5 ${danger ? "text-[#dc2626] hover:bg-[#fee2e2]" : "text-muted hover:bg-soft hover:text-ink"}`}>
      {children}
    </button>
  );
}
const upSvg = (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
const downSvg = (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>);
const copySvg = (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
const trashSvg = (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>);
const chevSvg = (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>);

export function QuizForm({ initial }: { initial?: QuizFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);
  const keySeq = useRef(0);
  const newKey = () => `q${Date.now()}_${keySeq.current++}`;
  const blank = (mode: "single" | "multiple"): DraftQuestion => ({
    key: newKey(), text: "", mode, marks: "1",
    options: ["", "", "", ""], correct: [], explanation: "", collapsed: false,
  });

  const [title, setTitle] = useState(initial?.title ?? "");
  const [playlistId, setPlaylistId] = useState(initial?.playlistId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [pricing, setPricing] = useState<"free" | "paid">(initial?.pricing ?? "paid");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [currency, setCurrency] = useState("");
  // Currency options and default come from GET /api/v1/config (backend .env).
  const { config } = usePublicConfig();
  const defaultCurrency = config?.defaultCurrency || "USD";
  const currencies = config?.currencies?.length ? config.currencies : [defaultCurrency];
  useEffect(() => {
    if (!currency && config?.defaultCurrency) setCurrency(config.defaultCurrency);
  }, [currency, config]);
  const [passingMarks, setPassingMarks] = useState(initial?.passingMarks ?? "");
  const [timeLimit, setTimeLimit] = useState(initial?.timeLimit ?? "15");
  const [attempts, setAttempts] = useState(initial?.attempts ?? "1");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [videoId, setVideoId] = useState(initial?.videoId ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    initial
      ? initial.questions.map((q) => ({
        key: q.qid, qid: q.qid, text: q.text, mode: q.mode, marks: q.marks,
        options: q.options.length ? q.options : ["", ""], correct: q.correct,
        explanation: q.explanation, collapsed: true,
      }))
      : [blank("single")]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);

  const totalMarks = questions.reduce((s, q) => s + Math.max(0, Number(q.marks) || 0), 0);
  const passNum = passingMarks === "" ? 0 : Number(passingMarks);
  const passPct = totalMarks > 0 ? Math.round((passNum / totalMarks) * 100) : 0;

  const patchQ = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (key: string, dir: -1 | 1) =>
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      setPreviewIdx((p) => (p === i ? j : p === j ? i : p));
      return next;
    });
  const duplicate = (key: string) =>
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      if (i < 0) return qs;
      const copy = { ...qs[i]!, key: newKey(), collapsed: true };
      return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
    });

  const toggleCorrect = (q: DraftQuestion, idx: number) => {
    if (q.mode === "single") patchQ(q.key, { correct: [idx] });
    else patchQ(q.key, { correct: q.correct.includes(idx) ? q.correct.filter((c) => c !== idx) : [...q.correct, idx] });
  };

  const cleanOptions = (q: DraftQuestion, n: number): { options: string[]; correct: number[] } => {
    const label = q.text.trim() ? `"${q.text.trim().slice(0, 40)}"` : `Question ${n}`;
    const texts = q.options.map((o) => o.trim());
    const keep: string[] = [];
    const remap = new Map<number, number>();
    texts.forEach((t, i) => {
      if (t === "" && !q.correct.includes(i)) return;
      remap.set(i, keep.length);
      keep.push(t);
    });
    if (keep.some((t) => t === "")) throw new Error(`${label} has an empty correct option — fill it in or unmark it.`);
    const correct = q.correct.map((i) => remap.get(i)).filter((v): v is number => v !== undefined);
    if (keep.length < 2) throw new Error(`${label} needs at least 2 options.`);
    if (q.mode === "single" && correct.length !== 1) throw new Error(`${label} needs exactly one correct answer.`);
    if (q.mode === "multiple" && correct.length < 1) throw new Error(`${label} needs at least one correct answer.`);
    return { options: keep, correct };
  };

  const save = async (nextStatus: "draft" | "published") => {
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    const tagErr = checkTags(tags); if (tagErr) { setError(tagErr); return; }
    if (!questions.length) { setError("Add at least one question."); return; }
    const t = Number(timeLimit);
    if (!Number.isInteger(t) || t < 1 || t > 1440) { setError("Time limit must be 1–1440 minutes."); return; }
    const att = attempts === "unlimited" ? null : Number(attempts);
    if (att !== null && (!Number.isInteger(att) || att < 1 || att > 20)) { setError("Attempts allowed must be 1–20 or No bound."); return; }
    if (pricing === "paid") { const pe = checkPrice(price); if (pe) { setError(pe); return; } if (!currency) { setError("Currency is required for a paid quiz — choose a currency."); return; } }
    if (totalMarks < 1) { setError("Total marks must be at least 1 — give your questions marks."); return; }
    if (passingMarks !== "" && !(passNum >= 0 && passNum <= totalMarks)) { setError(`Passing marks must be between 0 and ${totalMarks}.`); return; }

    let cleaned: { q: DraftQuestion; options: string[]; correct: number[]; marks: number }[];
    try {
      cleaned = questions.map((q, i) => {
        if (!q.text.trim()) throw new Error(`Question ${i + 1} needs text.`);
        const marks = Number(q.marks);
        if (!Number.isFinite(marks) || marks < 0 || marks > 1000) throw new Error(`Question ${i + 1} marks must be 0–1000.`);
        const { options, correct } = cleanOptions(q, i + 1);
        return { q, options, correct, marks };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your questions.");
      return;
    }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      // Edit mode: update existing questions, create new ones, delete removed
      // ones. Questions owned by another teacher stay linked but unchanged.
      const questionPayload = (c: { q: DraftQuestion; options: string[]; correct: number[]; marks: number }) => ({
        title: c.q.text.trim().slice(0, 200), description: "", tags,
        visibility, status: nextStatus,
        price: 0, currency: defaultCurrency,
        type: "mcq", prompt: c.q.text.trim(), answer: "", rubric: "",
        linkedContentId: null,
        options: c.options, correctOptions: c.correct,
        multiple: c.q.mode === "multiple",
        marks: c.marks, explanation: c.q.explanation.trim(),
      });
      const ids: string[] = [];
      let skipped = 0;
      for (const c of cleaned) {
        if (isEdit && c.q.qid) {
          try {
            await apiPatch(`/api/v1/questions/${c.q.qid}`, questionPayload(c));
          } catch (e) {
            if (e instanceof ApiError && e.status === 403) { skipped++; }
            else throw e;
          }
          ids.push(c.q.qid);
        } else {
          const created = await apiPost<{ _id: string }>("/api/v1/questions", questionPayload(c));
          ids.push(created._id);
        }
      }
      if (isEdit) {
        const kept = new Set(ids);
        for (const q of initial!.questions) {
          if (kept.has(q.qid)) continue;
          await apiDelete(`/api/v1/questions/${q.qid}`).catch((e) => {
            if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return;
            throw e;
          });
        }
      }
      const payload = {
        title: title.trim(), description, tags,
        visibility, status: nextStatus,
        price: pricing === "paid" ? Number(price) : 0, currency: currency || defaultCurrency,
        questionIds: ids,
        durationMinutes: t, maxAttempts: att,
        accessPolicy: pricing === "paid" ? "paid" : "free",
        passingMarks: passingMarks === "" ? 0 : passNum,
        playlistId: playlistId || null,
        videoId: videoId.trim(),
        kind: "quiz",
      };
      if (isEdit) {
        await apiPatch(`/api/v1/exams/${initial!.examId}`, payload);
        toast(skipped ? `Quiz updated. ${skipped} shared question(s) kept unchanged.` : "Quiz updated.");
      } else {
        await apiPost("/api/v1/exams", payload);
        toast(nextStatus === "published"
          ? "Quiz published. MCQ answers are saved — submissions grade instantly."
          : "Quiz saved as draft.");
      }
      router.push("/teacher/exams");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the quiz.");
    } finally {
      setBusy(null);
    }
  };

  const preview = questions[Math.min(previewIdx, Math.max(0, questions.length - 1))];

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={isEdit ? "/teacher/exams" : "/teacher/exams/new"} className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;{isEdit ? "Back to All Tests" : "Back to Test Types"}</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16a34a] text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{isEdit ? "Edit Quiz" : "Create Quiz"}</h1>
          <p className="text-[15px] text-muted">{isEdit ? "Update every part of this quiz — details, questions, pricing, and settings." : "Create a quiz with multiple-choice questions. You can set a price to sell this quiz."}</p>
        </div>
      </div>

      {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* basic info */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Basic Information">
            <h2 className="text-[17px] font-bold">Basic Information</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Title</Label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Add a title" className={inputCls} />
                <p className="mt-1 text-right text-xs text-muted">{title.length}/200</p>
              </div>
              <div>
                <Label optional>Playlist</Label>
                <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} className={inputCls}>
                  <option value="">No playlist</option>
                  {(playlists.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2">
              <Label>Description</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000}
                placeholder="Add a description" className={inputCls} />
              <p className="mt-1 text-right text-xs text-muted">{description.length}/5000</p>
            </div>
            <div className="mt-2">
              <Label optional>Tags</Label>
              <TagsInput value={tags} onChange={setTags} />
            </div>
            <h3 className="mt-5 text-[16px] font-bold">Pricing</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pricing">
              {(["free", "paid"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={pricing === p} onClick={() => setPricing(p)}
                  className={`rounded-xl border p-4 text-left ${pricing === p ? "border-[#16a34a] bg-[#f0fdf4] dark:bg-brandsoft" : "border-line"}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${pricing === p ? "border-[#16a34a]" : "border-line"}`}>
                      {pricing === p && <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />}
                    </span>
                    {p === "free" ? "Free Quiz" : "Paid Quiz"}
                  </span>
                  <span className="mt-0.5 block pl-7 text-[13px] text-muted">{p === "free" ? "Students can take this quiz for free." : "Set a price to sell this quiz."}</span>
                </button>
              ))}
            </div>
            {pricing === "paid" && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Price ({currency || defaultCurrency})</Label>
                  <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Set amount" className={inputCls} />
                  <p className="mt-1.5 text-[13px] text-muted">Set a price for this quiz. Students need to purchase to take this quiz.</p>
                </div>
                <div>
                  <Label required>Currency</Label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}><option value="" disabled>Set currency</option>{currencies.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}</select>
                </div>
              </div>
            )}
          </section>

          {/* questions */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Questions">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold">Questions</h2>
            </div>

            <div className="mt-4 space-y-4">
              {questions.map((q, qi) => (
                <article key={q.key} className="rounded-xl border border-line">
                  <div className="flex items-center gap-1 px-3 py-2.5">
                    <span aria-hidden className="cursor-grab px-1 text-muted">⋮⋮</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">Q{qi + 1}. {q.text || "Untitled question"} <span className="font-normal text-muted">({Number(q.marks) || 0} mark{(Number(q.marks) || 0) === 1 ? "" : "s"})</span></p>
                    <IconBtn label="Move up" onClick={() => move(q.key, -1)}>{upSvg}</IconBtn>
                    <IconBtn label="Move down" onClick={() => move(q.key, 1)}>{downSvg}</IconBtn>
                    <IconBtn label="Duplicate question" onClick={() => duplicate(q.key)}>{copySvg}</IconBtn>
                    <IconBtn label="Delete question" danger onClick={() => { setQuestions((qs) => qs.filter((x) => x.key !== q.key)); setPreviewIdx(0); }}>{trashSvg}</IconBtn>
                    <IconBtn label={q.collapsed ? "Expand" : "Collapse"} onClick={() => patchQ(q.key, { collapsed: !q.collapsed })}>
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${q.collapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                    </IconBtn>
                  </div>
                  {!q.collapsed && (
                    <div className="space-y-3 border-t border-line p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_220px_110px]">
                        <div>
                          <Label required>Question Text</Label>
                          <input value={q.text} onChange={(e) => patchQ(q.key, { text: e.target.value })} maxLength={500} placeholder="Write the question" className={inputCls} />
                        </div>
                        <div>
                          <Label>Question Type</Label>
                          <div className="relative">
                            <select value={q.mode} onChange={(e) => {
                              const mode = e.target.value as "single" | "multiple";
                              patchQ(q.key, { mode, correct: mode === "single" ? q.correct.slice(0, 1) : q.correct });
                            }} className={`${inputCls} appearance-none pr-9`}>
                              <option value="single">○ Multiple Choice (Single Answer)</option>
                              <option value="multiple">☑ Multiple Choice (Multiple Answers)</option>
                            </select>
                            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{chevSvg}</span>
                          </div>
                        </div>
                        <div>
                          <Label required>Marks</Label>
                          <input type="number" min={0} max={1000} value={q.marks} onChange={(e) => patchQ(q.key, { marks: e.target.value })} className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <Label required>Options</Label>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => {
                            const on = q.correct.includes(oi);
                            return (
                              <div key={oi} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${on ? "border-[#16a34a] bg-[#f0fdf4] dark:bg-brandsoft" : "border-line"}`}>
                                <button type="button" role={q.mode === "single" ? "radio" : "checkbox"} aria-checked={on}
                                  aria-label={`Mark option ${oi + 1} as ${q.mode === "single" ? "the" : "a"} correct answer`}
                                  onClick={() => toggleCorrect(q, oi)}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-[#16a34a]" : "border-line"}`}>
                                  {on && <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />}
                                </button>
                                <input value={opt} onChange={(e) => patchQ(q.key, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })}
                                  placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`} maxLength={500}
                                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70" />
                                <IconBtn label={`Remove option ${oi + 1}`} danger onClick={() => patchQ(q.key, {
                                  options: q.options.filter((_, j) => j !== oi),
                                  correct: q.correct.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c)),
                                })}>{trashSvg}</IconBtn>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex items-center justify-start gap-3">
                            {q.options.length < 10 && (
                              <button type="button" onClick={() => patchQ(q.key, { options: [...q.options, ""] })}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium hover:bg-soft">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                                Add Option
                              </button>
                            )}
                          </div>
                      </div>
                      <div>
                        <Label optional>Explanation</Label>
                        <input value={q.explanation} onChange={(e) => patchQ(q.key, { explanation: e.target.value })} maxLength={5000}
                          placeholder="Explain a logic against answer (student can see after submit the answer)" className={inputCls} />
                        <p className="mt-1 text-right text-xs text-muted">{q.explanation.length}/5000</p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {!questions.length && <Empty title="No questions" body="Add your first MCQ to start building the quiz." />}
            </div>

            <div className="mt-4 flex items-center justify-end">
              <div className="relative">
                <div className="flex overflow-hidden rounded-lg bg-[#16a34a] text-sm font-semibold text-white">
                  <button type="button" onClick={() => { setQuestions((qs) => [...qs, blank("single")]); setPreviewIdx(questions.length); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 hover:bg-[#15803d]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Add Question
                  </button>
                  <button type="button" aria-label="Question type to add" aria-expanded={addOpen} onClick={() => setAddOpen((o) => !o)} className="border-l border-white/30 px-2.5 hover:bg-[#15803d]">▾</button>
                </div>
                {addOpen && (
                  <>
                    <button aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setAddOpen(false)} />
                    <div className="absolute bottom-full right-0 z-20 mb-1 w-64 rounded-xl border border-line bg-card py-1 text-sm shadow-lg">
                      <button type="button" className="block w-full px-4 py-2 text-left hover:bg-soft" onClick={() => { setQuestions((qs) => [...qs, blank("single")]); setPreviewIdx(questions.length); setAddOpen(false); }}>Single answer MCQ</button>
                      <button type="button" className="block w-full px-4 py-2 text-left hover:bg-soft" onClick={() => { setQuestions((qs) => [...qs, blank("multiple")]); setPreviewIdx(questions.length); setAddOpen(false); }}>Multiple answers MCQ</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Quiz Settings">
            <h2 className="text-[17px] font-bold">Quiz Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label required>Total Marks</Label>
                <input value={String(totalMarks)} readOnly aria-readonly title="Auto-calculated from question marks"
                  className={`${inputCls} bg-soft`} />
              </div>
              <div>
                <Label required>Passing Marks</Label>
                <input type="number" min={0} max={Math.max(totalMarks, 0)} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} placeholder="12" className={inputCls} />
              </div>
              <div>
                <Label required>Time Limit (Minutes)</Label>
                <input type="number" min={1} max={1440} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label required>Attempts Allowed</Label>
                <select value={attempts} onChange={(e) => setAttempts(e.target.value)} className={inputCls}>
                  {["1", "2", "3", "4", "5", "10", "20"].map((n) => <option key={n} value={n}>{n}</option>)}
                  {!["1", "2", "3", "4", "5", "10", "20", "unlimited"].includes(attempts) && <option value={attempts}>{attempts}</option>}
                  <option value="unlimited">No bound</option>
                </select>
              </div>
              <div>
                <Label required>Visibility</Label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputCls}>
                  <option value="public">🌐 Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
                <p className="mt-1 text-xs text-muted">Who can take this quiz.</p>
              </div>
              <div>
                <Label required>Status</Label>
                <select value="published" onChange={() => undefined} aria-label="Status (chosen when saving below)" className={inputCls}>
                  <option value="published">▷ Published</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label optional>Video ID</Label>
                <input value={videoId} onChange={(e) => setVideoId(e.target.value)} maxLength={100}
                  placeholder="YouTube video ID or own Video ID" className={inputCls} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Quiz Preview">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Quiz Preview</h2>
              {questions.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted">
                  <span>{Math.min(previewIdx + 1, questions.length)}/{questions.length}</span>
                  <IconBtn label="Previous question" onClick={() => setPreviewIdx((p) => Math.max(0, p - 1))}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
                  </IconBtn>
                  <IconBtn label="Next question" onClick={() => setPreviewIdx((p) => Math.min(questions.length - 1, p + 1))}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                  </IconBtn>
                </div>
              )}
            </div>
            {preview ? (
              <div className="mt-3 rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{preview.text || "Untitled question"}</p>
                  <span className="shrink-0 text-[13px] text-muted">({Number(preview.marks) || 0} mark{(Number(preview.marks) || 0) === 1 ? "" : "s"})</span>
                </div>
                <div className="mt-3 space-y-2">
                  {preview.options.map((opt, oi) => {
                    const on = preview.correct.includes(oi);
                    return (
                      <div key={oi} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${on ? "border-[#16a34a] bg-[#f0fdf4] dark:bg-brandsoft" : "border-line"}`}>
                        <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-[#16a34a]" : "border-line"}`}>
                          {on && <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />}
                        </span>
                        <span className={opt ? "" : "text-muted/70"}>{opt || `Option ${oi + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Add a question to see the preview.</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Question Summary">
            <h2 className="text-[17px] font-bold">Question Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Total Questions", String(questions.length)],
                ["Total Marks", String(totalMarks)],
                ["Passing Marks", passingMarks === "" ? "—" : `${passNum} (${passPct}%)`],
                ["Time Limit", `${timeLimit || "—"} minutes`],
                ["Attempts Allowed", attempts === "unlimited" ? "No bound" : attempts],
                ["Price", pricing === "paid" ? `${currency || defaultCurrency} ${Number(price) || 0}` : "Free"],
                ["Quiz Type", pricing === "paid" ? "Paid Quiz" : "Free Quiz"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => save("draft")} disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold hover:bg-soft disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
              {busy === "draft" ? "Saving…" : "Save as Draft"}
            </button>
            <button onClick={() => save("published")} disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M7 5l12 7-12 7z" /></svg>
              {busy === "publish" ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save & Publish" : "Publish Quiz"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
