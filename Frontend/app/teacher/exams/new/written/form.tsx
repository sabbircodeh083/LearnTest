"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { Notice, useToast } from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch, usePublicConfig } from "@/lib/hooks";
import { checkFutureDate, checkPrice, checkTags } from "@/lib/validation";
import type { Page, Playlist } from "@/lib/types";
import { currencySymbol } from "@/lib/types";

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
        placeholder="Add tags and press Enter..."
        aria-label="Add tags and press Enter" className="min-w-[180px] flex-1 bg-transparent outline-none placeholder:text-muted/70" />
    </div>
  );
}

type WrittenKind = "short" | "long" | "essay";
interface DraftWritten { key: string; qid?: string; kind: WrittenKind; text: string; marks: string; editing: boolean }

export interface WrittenEditQuestion { qid: string; kind: WrittenKind; text: string; marks: string }

export interface WrittenFormInitial {
  examId: string;
  title: string;
  playlistId: string;
  description: string;
  tags: string[];
  pricing: "free" | "paid";
  price: string;
  totalMarks: string;
  passingMarks: string;
  deadline: string;
  attempts: string;
  visibility: string;
  status: string;
  videoId: string;
  questions: WrittenEditQuestion[];
}

const KIND_META: Record<WrittenKind, { label: string; badge: string }> = {
  short: { label: "Short Answer", badge: "bg-[#dbeafe] text-[#1d6ce0]" },
  long: { label: "Long Answer", badge: "bg-[#ede9fe] text-[#7c3aed]" },
  essay: { label: "Essay", badge: "bg-[#ffedd5] text-[#c2410c]" },
};

const STUDENT_INSTRUCTIONS = [
  "Answer all questions in a PDF file.",
  "Write clear and detailed answers.",
  "Include proper explanations and examples.",
  "Make sure your PDF file is readable.",
  "Only PDF files are allowed.",
];

function fmtDeadline(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function WrittenForm({ initial }: { initial?: WrittenFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);
  const keySeq = useRef(0);
  const newKey = () => `w${Date.now()}_${keySeq.current++}`;

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

  const [questions, setQuestions] = useState<DraftWritten[]>(() =>
    initial
      ? initial.questions.map((q) => ({ key: q.qid, qid: q.qid, kind: q.kind, text: q.text, marks: q.marks, editing: false }))
      : [
        { key: "w1", kind: "short", text: "", marks: "", editing: true },
      ]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newKind, setNewKind] = useState<WrittenKind>("short");
  const [newText, setNewText] = useState("");
  const [newMarks, setNewMarks] = useState("");

  const [totalMarks, setTotalMarks] = useState(initial?.totalMarks ?? "100");
  const [passingMarks, setPassingMarks] = useState(initial?.passingMarks ?? "60");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "2026-12-31T23:59");
  const [attempts, setAttempts] = useState(initial?.attempts ?? "1");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [videoId, setVideoId] = useState(initial?.videoId ?? "");
  const [maxFileSize, setMaxFileSize] = useState("10 MB");
  const [maxFiles, setMaxFiles] = useState("1");

  const [previewTab, setPreviewTab] = useState<"desc" | "form">("desc");
  const [pvFile, setPvFile] = useState("");
  const [pvError, setPvError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);

  const totalNum = Number(totalMarks);
  const passNum = Number(passingMarks);
  const passPct = totalNum > 0 ? Math.round((passNum / totalNum) * 100) : 0;
  const questionsSum = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  const patchQ = (key: string, patch: Partial<DraftWritten>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (key: string, dir: -1 | 1) =>
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const addQuestion = () => {
    if (!newText.trim()) { setError("Write the question text first."); return; }
    if (!newMarks.trim()) { setError("Marks is required — enter a number from 0 to 1000."); return; }
    const m = Number(newMarks);
    if (!Number.isFinite(m) || m < 0 || m > 1000) { setError("Marks must be 0–1000."); return; }
    setError("");
    setQuestions((qs) => [...qs, { key: newKey(), kind: newKind, text: newText.trim(), marks: newMarks, editing: false }]);
    setNewText(""); setNewMarks(""); setNewKind("short"); setEditorOpen(false);
  };

  const save = async (nextStatus: "draft" | "published") => {
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    const tagErr = checkTags(tags); if (tagErr) { setError(tagErr); return; }
    if (!questions.length) { setError("Add at least one question."); return; }
    { const bad = questions.findIndex((q) => !q.text.trim()); if (bad >= 0) { setError(`Question ${bad + 1} needs text.`); return; } }
    { const bad = questions.findIndex((q) => { const m = Number(q.marks); return q.marks.trim() === "" || !Number.isFinite(m) || m < 0 || m > 1000; }); if (bad >= 0) { setError(`Question ${bad + 1} marks must be between 0 and 1000.`); return; } }
    if (!Number.isInteger(totalNum) || totalNum < 1) { setError("Total marks must be at least 1."); return; }
    if (questionsSum !== totalNum) { setError(`Question marks add up to ${questionsSum}, but total marks is ${totalNum}. Make them match.`); return; }
    if (!passingMarks.trim()) { setError("Passing marks is required — enter 0 or more."); return; }
    if (!(passNum >= 0 && passNum <= totalNum)) { setError(`Passing marks must be between 0 and ${totalMarks}.`); return; }
    const dlErr = checkFutureDate("Deadline", deadline); if (dlErr) { setError(dlErr); return; }
    const att = attempts === "unlimited" ? null : Number(attempts);
    if (att !== null && (!Number.isInteger(att) || att < 1 || att > 20)) { setError("Attempts allowed must be 1–20 or No bound."); return; }
    if (pricing === "paid") { const pe = checkPrice(price); if (pe) { setError(pe); return; } if (!currency) { setError("Currency is required for a paid written test — choose a currency."); return; } }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      // Edit mode: update existing questions, create new ones, delete removed
      // ones. Questions owned by another teacher stay linked but unchanged.
      const questionPayload = (q: DraftWritten) => ({
        title: q.text.trim().slice(0, 200), description: KIND_META[q.kind].label, tags,
        visibility, status: nextStatus,
        price: 0, currency: defaultCurrency,
        type: "short", prompt: q.text.trim(), answer: "", rubric: "",
        linkedContentId: null,
        options: [], correctOptions: [],
        multiple: false,
        marks: Number(q.marks) || 0, explanation: "",
      });
      const ids: string[] = [];
      let skipped = 0;
      for (const q of questions) {
        if (isEdit && q.qid) {
          try {
            await apiPatch(`/api/v1/questions/${q.qid}`, questionPayload(q));
          } catch (e) {
            if (e instanceof ApiError && e.status === 403) { skipped++; }
            else throw e;
          }
          ids.push(q.qid);
        } else {
          const created = await apiPost<{ _id: string }>("/api/v1/questions", questionPayload(q));
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
        // Take-home PDF test: no per-sitting time limit, so use the max window.
        durationMinutes: 1440, maxAttempts: att,
        accessPolicy: pricing === "paid" ? "paid" : "free",
        passingMarks: passNum,
        playlistId: playlistId || null,
        endsAt: new Date(deadline).toISOString(),
        videoId: videoId.trim(),
        kind: "written",
      };
      if (isEdit) {
        await apiPatch(`/api/v1/exams/${initial!.examId}`, payload);
        toast(skipped ? `Written test updated. ${skipped} shared question(s) kept unchanged.` : "Written test updated.");
      } else {
        await apiPost("/api/v1/exams", payload);
        toast(nextStatus === "published"
          ? "Written test published. Students answer and upload a PDF for manual grading."
          : "Written test saved as draft.");
      }
      router.push("/teacher/exams");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the written test.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={isEdit ? "/teacher/exams" : "/teacher/exams/new"} className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;{isEdit ? "Back to All Tests" : "Back to Test Types"}</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{isEdit ? "Edit Written Test" : "Create Written Test"}</h1>
          <p className="text-[15px] text-muted">{isEdit ? "Update every part of this written test — details, questions, pricing, and settings." : "Create a written test where students answer questions and submit as a PDF file."}</p>
        </div>
      </div>

      {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Basic information */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Basic Information">
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
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000}
                placeholder="Add a description" className={inputCls} />
              <p className="mt-1 text-right text-xs text-muted">{description.length}/1000</p>
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
                    {p === "free" ? "Free Test" : "Paid Test"}
                  </span>
                  <span className="mt-0.5 block pl-7 text-[13px] text-muted">{p === "free" ? "Students can take this test for free." : "Set a price to sell this test."}</span>
                </button>
              ))}
            </div>
            {pricing === "paid" && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Price ({currency || defaultCurrency})</Label>
                  <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Set amount" className={inputCls} />
                  <p className="mt-1.5 text-[13px] text-muted">Set a price for this test. Students need to purchase to access the test.</p>
                </div>
                <div>
                  <Label required>Currency</Label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}><option value="" disabled>Set currency</option>{currencies.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}</select>
                </div>
              </div>
            )}
          </section>

          {/* Add questions */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Add Questions">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold">Add Questions</h2>
              <p className="text-sm text-muted">Total Questions: {questions.length}</p>
            </div>

            {editorOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-[#bfdbfe] bg-[#f8fbff] p-4 dark:bg-soft">
                <div className="grid gap-3 sm:grid-cols-[200px_1fr_130px]">
                  <div>
                    <Label required>Answer Type</Label>
                    <select value={newKind} onChange={(e) => setNewKind(e.target.value as WrittenKind)} className={inputCls}>
                      <option value="short">Short Answer</option>
                      <option value="long">Long Answer</option>
                      <option value="essay">Essay</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <Label required>Question</Label>
                    <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={2} maxLength={5000}
                      placeholder="Write a question here" className={inputCls} />
                  </div>
                  <div>
                    <Label required>Marks</Label>
                    <input type="number" min={0} max={1000} value={newMarks} onChange={(e) => setNewMarks(e.target.value)} placeholder="10" className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addQuestion}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d6ce0] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                    Add to test
                  </button>
                  <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-soft">Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {questions.map((q, qi) => (
                <article key={q.key} className="flex items-center gap-3 rounded-xl border border-line p-4">
                  <span className="flex flex-col items-center gap-0.5 text-muted">
                    <button type="button" aria-label={`Move question ${qi + 1} up`} onClick={() => move(q.key, -1)} className="rounded p-0.5 hover:bg-soft hover:text-ink">▲</button>
                    <span aria-hidden className="text-xs">⋮⋮</span>
                    <button type="button" aria-label={`Move question ${qi + 1} down`} onClick={() => move(q.key, 1)} className="rounded p-0.5 hover:bg-soft hover:text-ink">▼</button>
                  </span>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">{qi + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${KIND_META[q.kind].badge}`}>{KIND_META[q.kind].label}</span>
                    {q.editing ? (
                      <div className="mt-1.5 space-y-2">
                        <select value={q.kind} onChange={(e) => patchQ(q.key, { kind: e.target.value as WrittenKind })} className={inputCls} aria-label="Answer type">
                          <option value="short">Short Answer</option>
                          <option value="long">Long Answer</option>
                          <option value="essay">Essay</option>
                        </select>
                        <textarea value={q.text} onChange={(e) => patchQ(q.key, { text: e.target.value })} rows={3} maxLength={5000} placeholder="Write a question here" className={inputCls} aria-label="Question text" />
                        <button type="button" onClick={() => { if (!q.text.trim()) { setError(`Question ${qi + 1} needs text.`); return; } setError(""); patchQ(q.key, { editing: false }); }}
                          className="rounded-lg bg-[#16a34a] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d]">Done</button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[14px] leading-snug">{q.text || <span className="text-muted/70">Write a question here</span>}</p>
                    )}
                  </div>
                  <div className="w-[76px] shrink-0">
                    <input type="number" min={0} max={1000} value={q.marks} onChange={(e) => patchQ(q.key, { marks: e.target.value })}
                      aria-label={`Marks for question ${qi + 1}`} className={`${inputCls} text-center font-semibold`} />
                    <p className="mt-0.5 text-center text-xs text-muted">Marks</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" title="Edit question" aria-label={`Edit question ${qi + 1}`} onClick={() => patchQ(q.key, { editing: !q.editing })}
                      className="rounded-lg border border-line p-2 text-muted hover:bg-soft hover:text-ink">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                    </button>
                    <button type="button" title="Delete question" aria-label={`Delete question ${qi + 1}`}
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                      className="rounded-lg border border-line p-2 text-[#dc2626] hover:bg-[#fee2e2]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>
                    </button>
                  </div>
                </article>
              ))}
              <p className={`text-xs ${questionsSum === totalNum ? "text-muted" : "font-medium text-danger"}`}>
                Question marks total: {questionsSum} / {totalMarks || "—"}{questionsSum !== totalNum ? " — must match Total Marks." : ""}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button type="button" onClick={() => setEditorOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3.5 py-2 text-sm font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add Question
              </button>
            </div>
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-card p-5" aria-label="Test Settings">
            <h2 className="text-[17px] font-bold">Test Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label required>Total Marks</Label>
                <input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label required>Passing Marks</Label>
                <input type="number" min={0} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label required>Deadline</Label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
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
                <p className="mt-1 text-xs text-muted">Who can take this test.</p>
              </div>
              <div>
                <Label required>Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="draft">Draft</option>
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

          <section className="rounded-xl border border-line bg-card p-5" aria-label="File Upload Settings">
            <h2 className="text-[17px] font-bold">File Upload Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label required>Maximum File Size</Label>
                <select value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} className={inputCls}>
                  {["5 MB", "10 MB", "25 MB", "50 MB", "100 MB"].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">Maximum size per file.</p>
              </div>
              <div>
                <Label required>Maximum Files</Label>
                <select value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} className={inputCls}>
                  {["1", "2", "3", "5", "10"].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">Number of files a student can upload.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5" aria-label="Student View Preview">
            <h2 className="text-[17px] font-bold">Student View Preview</h2>
            <div className="mt-2 flex gap-4 border-b border-line text-sm font-semibold" role="tablist" aria-label="Preview tabs">
              {(["desc", "form"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={previewTab === t} onClick={() => setPreviewTab(t)}
                  className={`-mb-px border-b-2 px-1 pb-2 ${previewTab === t ? "border-[#16a34a] text-[#16a34a]" : "border-transparent text-muted hover:text-ink"}`}>
                  {t === "desc" ? "Test Description" : "Submission Form"}
                </button>
              ))}
            </div>

            {previewTab === "desc" ? (
              <div className="mt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{title.trim() || "Untitled test"}</p>
                  {pricing === "paid" && <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">{currencySymbol(currency || 'USD')}{Number(price) || 0}</span>}
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span>📄 {questions.length} Question{questions.length === 1 ? "" : "s"}</span>
                  <span>🕒 Deadline: {deadline ? fmtDeadline(deadline) : "—"}</span>
                  <span>📄 {attempts === "unlimited" ? "No bound" : `${attempts} Attempt${attempts === "1" ? "" : "s"}`}</span>
                </p>
                <p className="mt-3 text-sm font-bold">Description</p>
                <p className="mt-1 text-[13px] text-muted">{description.trim() || "No description yet."}</p>
                <div className="mt-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 dark:bg-infosoft">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#1d6ce0]">
                    <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1d6ce0] text-[10px] text-white">i</span>
                    Instructions for Students
                  </p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-muted">
                    {STUDENT_INSTRUCTIONS.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <form className="mt-3" noValidate onSubmit={(e) => {
                e.preventDefault();
                setPvError("");
                if (!pvFile) { setPvError("Please upload your PDF answer file — it is required."); return; }
                toast("Preview submit OK — PDF attached. Students submit from their own view.");
              }}>
                <p className="font-bold">Submit Your Answer</p>
                <p className="text-[13px] text-muted">Write your answers to the questions and upload as a PDF file.</p>
                {pvError && <p role="alert" className="mt-2 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{pvError}</p>}
                <div className="mt-2 rounded-lg bg-soft p-3">
                  <p className="text-[13px] font-semibold">🗎 1. PDF File <span aria-hidden className="text-danger">*</span></p>
                  <label className="mt-1.5 block cursor-pointer rounded-lg border border-dashed border-[#93c5fd] bg-card px-3 py-3 text-center">
                    <span className="block text-sm font-semibold text-[#1d6ce0]">☁ Click to upload or drag and drop</span>
                    <span className="block text-xs text-muted">Only .pdf files are allowed (Max {maxFileSize}){pvFile ? ` — selected: ${pvFile}` : ""}</span>
                    <input type="file" accept=".pdf" required aria-required="true" aria-label="PDF File (required)" className="hidden"
                      onChange={(e) => setPvFile(e.target.files?.[0]?.name ?? "")} />
                  </label>
                </div>
                <div className="mt-2.5 rounded-lg bg-soft p-3">
                  <p className="text-[13px] font-bold">Instructions for Students</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted">
                    {STUDENT_INSTRUCTIONS.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
                <button type="submit"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">
                  ➤ Submit Answer
                </button>
              </form>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5" aria-label="Test Summary">
            <h2 className="text-[17px] font-bold">Test Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Total Marks", totalMarks || "—"],
                ["Passing Marks", `${passingMarks || "—"} (${passPct}%)`],
                ["Price", pricing === "paid" ? `${Number(price) || 0} ${currency || defaultCurrency}` : "Free"],
                ["Deadline", deadline ? fmtDeadline(deadline) : "—"],
                ["Max File Size", maxFileSize],
                ["Max Files", maxFiles],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-dotted border-line pb-1.5 last:border-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => save("draft")} disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-[#1d4ed8] hover:bg-soft disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
              {busy === "draft" ? "Saving…" : "Save as Draft"}
            </button>
            <button onClick={() => save("published")} disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M7 5l12 7-12 7z" /></svg>
              {busy === "publish" ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save & Publish" : "Publish Test"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
