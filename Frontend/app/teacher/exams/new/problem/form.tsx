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

interface Problem { key: string; qid?: string; name: string; url: string; topic: string; editing: boolean }
interface ProblemList { key: string; qid?: string; title: string; url: string; blurb: string; topics: string[]; editing: boolean }

export interface ProblemEditItem { qid: string; name: string; url: string; extra: string; topics: string[] }

export interface ProblemFormInitial {
  examId: string;
  title: string;
  playlistId: string;
  description: string;
  tags: string[];
  pricing: "free" | "paid";
  price: string;
  mode: "individual" | "list";
  problems: ProblemEditItem[];
  lists: ProblemEditItem[];
  totalMarks: string;
  passingMarks: string;
  deadline: string;
  attempts: string;
  visibility: string;
  status: string;
  videoId: string;
}

const TAG_TONES = [
  "bg-[#ede9fe] text-[#7c3aed]",
  "bg-[#dbeafe] text-[#1d6ce0]",
  "bg-[#dcfce7] text-[#15803d]",
  "bg-[#fce7f3] text-[#be185d]",
  "bg-[#ffedd5] text-[#c2410c]",
];

const STUDENT_INSTRUCTIONS = [
  "Open each problem from the problem list.",
  "Solve the problems on the original platform.",
  "You can practice as many times as you want.",
  "No file submission is required.",
  "Your progress will not be reviewed, so try your best.",
];

/** Small platform mark derived from the URL host (real logos can't be hotlinked reliably). */
function PlatformMark({ url }: { url: string }) {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { host = ""; }
  const known: [RegExp, string, string][] = [
    [/leetcode/, "LC", "text-[#b45309]"],
    [/codeforces/, "CF", "text-[#1d6ce0]"],
    [/atcoder/, "AC", "text-ink"],
    [/hackerrank/, "HR", "text-[#15803d]"],
    [/codechef/, "CC", "text-[#92400e]"],
    [/spoj/, "SP", "text-[#1d6ce0]"],
    [/lightoj|toph/, "LO", "text-[#0d9488]"],
  ];
  const hit = known.find(([re]) => re.test(host));
  return (
    <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft text-sm font-black ${hit ? hit[2] : "text-muted"}`}>
      {hit ? hit[1] : "⌨"}
    </span>
  );
}

function fmtDeadline(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const isUrl = (s: string) => /^https?:\/\/.+\..+/.test(s.trim());

export function ProblemForm({ initial }: { initial?: ProblemFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);
  const keySeq = useRef(0);
  const newKey = () => `p${Date.now()}_${keySeq.current++}`;

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

  const [mode, setMode] = useState<"individual" | "list">(initial?.mode ?? "individual");
  const [problems, setProblems] = useState<Problem[]>(() =>
    initial
      ? initial.problems.map((p) => ({ key: p.qid, qid: p.qid, name: p.name, url: p.url, topic: p.extra, editing: false }))
      : []);
  const [lists, setLists] = useState<ProblemList[]>(() =>
    initial
      ? initial.lists.map((l) => ({ key: l.qid, qid: l.qid, title: l.name, url: l.url, blurb: l.extra, topics: l.topics, editing: false }))
      : []);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftTopic, setDraftTopic] = useState("");
  const [draftBlurb, setDraftBlurb] = useState("");
  const [draftTopics, setDraftTopics] = useState("");

  const [totalMarks, setTotalMarks] = useState(initial?.totalMarks ?? "100");
  const [passingMarks, setPassingMarks] = useState(initial?.passingMarks ?? "60");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "2026-12-31T23:59");
  const [attempts, setAttempts] = useState(initial?.attempts ?? "1");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [videoId, setVideoId] = useState(initial?.videoId ?? "");

  const [previewTab, setPreviewTab] = useState<"desc" | "list">("desc");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);

  const totalNum = Number(totalMarks);
  const passNum = Number(passingMarks);
  const passPct = totalNum > 0 ? Math.round((passNum / totalNum) * 100) : 0;
  const itemCount = mode === "individual" ? problems.length : lists.length;

  const moveP = (key: string, dir: -1 | 1) =>
    setProblems((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const moveL = (key: string, dir: -1 | 1) =>
    setLists((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const openEditor = () => {
    setDraftName(""); setDraftUrl(""); setDraftTopic(""); setDraftBlurb(""); setDraftTopics("");
    setEditorOpen(true);
  };

  const addItem = () => {
    if (mode === "individual") {
      if (!draftName.trim()) { setError("Give the problem a name."); return; }
      if (!isUrl(draftUrl)) { setError("Enter a valid problem URL starting with http(s)://."); return; }
      setError("");
      setProblems((qs) => [...qs, { key: newKey(), name: draftName.trim(), url: draftUrl.trim(), topic: draftTopic.trim(), editing: false }]);
    } else {
      if (!draftName.trim()) { setError("Give the problem list a title."); return; }
      if (!isUrl(draftUrl)) { setError("Enter a valid list URL starting with http(s)://."); return; }
      if (draftTopics.split(",").map((x) => x.trim()).filter(Boolean).length > 10) { setError("You can add at most 10 topics — remove some first."); return; }
      setError("");
      setLists((qs) => [...qs, {
        key: newKey(), title: draftName.trim(), url: draftUrl.trim(), blurb: draftBlurb.trim(),
        topics: draftTopics.split(",").map((t) => t.trim()).filter(Boolean), editing: false,
      }]);
    }
    setEditorOpen(false);
  };

  const save = async (nextStatus: "draft" | "published") => {
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    const tagErr = checkTags(tags); if (tagErr) { setError(tagErr); return; }
    if (!Number.isInteger(totalNum) || totalNum < 1) { setError("Total marks must be at least 1."); return; }
    if (!passingMarks.trim()) { setError("Passing marks is required — enter 0 or more."); return; }
    if (!(passNum >= 0 && passNum <= totalNum)) { setError(`Passing marks must be between 0 and ${totalMarks}.`); return; }
    const dlErr = checkFutureDate("Deadline", deadline); if (dlErr) { setError(dlErr); return; }
    const att = attempts === "unlimited" ? null : Number(attempts);
    if (att !== null && (!Number.isInteger(att) || att < 1 || att > 20)) { setError("Attempts allowed must be 1–20 or No bound."); return; }
    if (pricing === "paid") { const pe = checkPrice(price); if (pe) { setError(pe); return; } if (!currency) { setError("Currency is required for a paid test — choose a currency."); return; } }
    const items = mode === "individual" ? problems : lists;
    if (!items.length) { setError(mode === "individual" ? "Add at least one problem link." : "Add at least one problem list link."); return; }
    { const badName = items.findIndex((it) => !(mode === "individual" ? (it as Problem).name : (it as ProblemList).title).trim()); if (badName >= 0) { setError(`${mode === "individual" ? "Problem" : "List"} ${badName + 1} needs a name/title.`); return; } }
    { const bad = items.findIndex((it) => !isUrl(it.url)); if (bad >= 0) { setError(`Link ${bad + 1} must be a valid URL starting with http(s)://.`); return; } }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      // No problem-set entity exists on the backend, so each problem/list is stored as a
      // `code` question (prompt = title, rubric carries the judge URL), sharing total marks
      // evenly. Students solve on the original judge; grading is manual/per-participation.
      // Edit mode: update existing questions, create new ones, delete removed ones.
      const share = Math.floor(totalNum / items.length);
      const itemPayload = (it: Problem | ProblemList, i: number) => {
        const isP = mode === "individual";
        const name = isP ? (it as Problem).name : (it as ProblemList).title;
        const extra = isP ? (it as Problem).topic : (it as ProblemList).blurb;
        return {
          title: name.slice(0, 200), description: isP ? "Individual problem" : "Problem list", tags,
          visibility, status: nextStatus,
          price: 0, currency: defaultCurrency,
          type: "code", prompt: `${name}\n${it.url}${extra ? `\n${extra}` : ""}`,
          answer: "", rubric: it.url,
          linkedContentId: null,
          options: [], correctOptions: [],
          multiple: false,
          marks: i === items.length - 1 ? totalNum - share * (items.length - 1) : share,
          explanation: "",
        };
      };
      const ids: string[] = [];
      let skipped = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        if (isEdit && it.qid) {
          try {
            await apiPatch(`/api/v1/questions/${it.qid}`, itemPayload(it, i));
          } catch (e) {
            if (e instanceof ApiError && e.status === 403) { skipped++; }
            else throw e;
          }
          ids.push(it.qid);
        } else {
          const created = await apiPost<{ _id: string }>("/api/v1/questions", itemPayload(it, i));
          ids.push(created._id);
        }
      }
      if (isEdit) {
        const kept = new Set(ids);
        for (const old of [...(initial!.problems ?? []), ...(initial!.lists ?? [])]) {
          if (kept.has(old.qid)) continue;
          await apiDelete(`/api/v1/questions/${old.qid}`).catch((e) => {
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
        durationMinutes: 1440, maxAttempts: att,
        accessPolicy: pricing === "paid" ? "paid" : "free",
        passingMarks: passNum,
        playlistId: playlistId || null,
        endsAt: new Date(deadline).toISOString(),
        videoId: videoId.trim(),
        kind: "problem",
      };
      if (isEdit) {
        await apiPatch(`/api/v1/exams/${initial!.examId}`, payload);
        toast(skipped ? `Test updated. ${skipped} shared problem(s) kept unchanged.` : "Problem solving test updated.");
      } else {
        await apiPost("/api/v1/exams", payload);
        toast(nextStatus === "published"
          ? "Problem solving test published. Students solve on the online judge."
          : "Problem solving test saved as draft.");
      }
      router.push("/teacher/exams");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the test.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={isEdit ? "/teacher/exams" : "/teacher/exams/new"} className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;{isEdit ? "Back to All Tests" : "Back to Test Types"}</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3e8ff] text-[#9333ea]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m9 10-2 2 2 2M15 10l2 2-2 2" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{isEdit ? "Edit Problem Solving Test" : "Create Problem Solving Test"}</h1>
          <p className="text-[15px] text-muted">{isEdit ? "Update every part of this test — details, problems, pricing, and settings." : "Create a problem solving test where students solve problems on an online judge."}</p>
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

          {/* Problem list */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Problem List">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold">Problem List</h2>
              <p className="text-sm text-muted">Total Problems: {itemCount}</p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Problem entry mode">
              <button type="button" role="tab" aria-selected={mode === "list"} onClick={() => { setMode("list"); setEditorOpen(false); }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${mode === "list" ? "border-[#16a34a] bg-[#f0fdf4] text-[#16a34a]" : "border-line text-muted hover:text-ink"}`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
                Add Problem List Link
              </button>
              <button type="button" role="tab" aria-selected={mode === "individual"} onClick={() => { setMode("individual"); setEditorOpen(false); }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${mode === "individual" ? "border-[#16a34a] bg-[#f0fdf4] text-[#16a34a]" : "border-line text-muted hover:text-ink"}`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                Add Individual Problem Links
              </button>
            </div>

            {editorOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-[#bbf7d0] bg-[#f8fdf9] p-4 dark:bg-soft">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label required>{mode === "individual" ? "Problem Name" : "List Title"}</Label>
                    <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={200}
                      placeholder={mode === "individual" ? "Two Sum" : "LeetCode Top Interview 150"} className={inputCls} />
                  </div>
                  <div>
                    <Label required>{mode === "individual" ? "Problem URL" : "List URL"}</Label>
                    <input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} inputMode="url"
                      placeholder="https://…" className={inputCls} />
                  </div>
                  {mode === "individual" ? (
                    <div>
                      <Label optional>Topic</Label>
                      <input value={draftTopic} onChange={(e) => setDraftTopic(e.target.value)} maxLength={60} placeholder="Array" className={inputCls} />
                    </div>
                  ) : (
                    <>
                      <div className="sm:col-span-2">
                        <Label optional>Short Description</Label>
                        <input value={draftBlurb} onChange={(e) => setDraftBlurb(e.target.value)} maxLength={300} placeholder="What is inside this list?" className={inputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label optional>Topics</Label>
                        <input value={draftTopics} onChange={(e) => setDraftTopics(e.target.value)} placeholder="Comma separated, e.g. Array, String" className={inputCls} />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addItem}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]">
                    Add to test
                  </button>
                  <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-soft">Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {mode === "individual" ? problems.map((p, i) => (
                <article key={p.key} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
                  <span className="flex flex-col items-center text-muted">
                    <button type="button" aria-label={`Move problem ${i + 1} up`} onClick={() => moveP(p.key, -1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▲</button>
                    <span aria-hidden className="text-xs">⋮⋮</span>
                    <button type="button" aria-label={`Move problem ${i + 1} down`} onClick={() => moveP(p.key, 1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▼</button>
                  </span>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">{i + 1}</span>
                  <PlatformMark url={p.url} />
                  <div className="min-w-0 flex-1">
                    {p.editing ? (
                      <div className="space-y-2">
                        <input value={p.name} onChange={(e) => setProblems((qs) => qs.map((x) => (x.key === p.key ? { ...x, name: e.target.value } : x)))}
                          maxLength={200} className={inputCls} aria-label="Problem name" />
                        <input value={p.url} onChange={(e) => setProblems((qs) => qs.map((x) => (x.key === p.key ? { ...x, url: e.target.value } : x)))}
                          inputMode="url" className={inputCls} aria-label="Problem URL" />
                        <div className="flex gap-2">
                          <input value={p.topic} onChange={(e) => setProblems((qs) => qs.map((x) => (x.key === p.key ? { ...x, topic: e.target.value } : x)))}
                            maxLength={60} placeholder="Topic" className={inputCls} aria-label="Topic" />
                          <button type="button" onClick={() => setProblems((qs) => qs.map((x) => (x.key === p.key ? { ...x, editing: false } : x)))}
                            className="shrink-0 rounded-lg bg-[#16a34a] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d]">Done</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-[15px] font-bold">{p.name}</p>
                        <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-[#1d6ce0] hover:underline">{p.url}</a>
                      </>
                    )}
                  </div>
                  {p.topic && !p.editing && (
                    <span className={`hidden shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold sm:inline-block ${TAG_TONES[i % TAG_TONES.length]}`}>{p.topic}</span>
                  )}
                  <div className="flex shrink-0 gap-1.5">
                    <a href={p.url} target="_blank" rel="noreferrer" title="Open problem" aria-label={`Open ${p.name}`}
                      className="rounded-lg border border-line p-2 text-[#1d6ce0] hover:bg-[#eff6ff]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>
                    </a>
                    <button type="button" title="Edit problem" aria-label={`Edit ${p.name}`}
                      onClick={() => setProblems((qs) => qs.map((x) => (x.key === p.key ? { ...x, editing: !x.editing } : x)))}
                      className="rounded-lg border border-line p-2 text-muted hover:bg-soft hover:text-ink">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                    </button>
                    <button type="button" title="Delete problem" aria-label={`Delete ${p.name}`}
                      onClick={() => setProblems((qs) => qs.filter((x) => x.key !== p.key))}
                      className="rounded-lg border border-line p-2 text-[#dc2626] hover:bg-[#fee2e2]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>
                    </button>
                  </div>
                </article>
              )) : lists.map((l, i) => (
                <article key={l.key} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
                  <span className="flex flex-col items-center text-muted">
                    <button type="button" aria-label={`Move list ${i + 1} up`} onClick={() => moveL(l.key, -1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▲</button>
                    <span aria-hidden className="text-xs">⋮⋮</span>
                    <button type="button" aria-label={`Move list ${i + 1} down`} onClick={() => moveL(l.key, 1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▼</button>
                  </span>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">{i + 1}</span>
                  <PlatformMark url={l.url} />
                  <div className="min-w-0 flex-1">
                    {l.editing ? (
                      <div className="space-y-2">
                        <input value={l.title} onChange={(e) => setLists((qs) => qs.map((x) => (x.key === l.key ? { ...x, title: e.target.value } : x)))}
                          maxLength={200} className={inputCls} aria-label="List title" />
                        <input value={l.url} onChange={(e) => setLists((qs) => qs.map((x) => (x.key === l.key ? { ...x, url: e.target.value } : x)))}
                          inputMode="url" className={inputCls} aria-label="List URL" />
                        <input value={l.blurb} onChange={(e) => setLists((qs) => qs.map((x) => (x.key === l.key ? { ...x, blurb: e.target.value } : x)))}
                          maxLength={300} placeholder="Short description" className={inputCls} aria-label="List description" />
                        <button type="button" onClick={() => setLists((qs) => qs.map((x) => (x.key === l.key ? { ...x, editing: false } : x)))}
                          className="rounded-lg bg-[#16a34a] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d]">Done</button>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-[15px] font-bold">{l.title}</p>
                        <a href={l.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-[#1d6ce0] hover:underline">{l.url}</a>
                        {l.blurb && <p className="mt-0.5 truncate text-[13px] text-muted">{l.blurb}</p>}
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <a href={l.url} target="_blank" rel="noreferrer" title="Open list" aria-label={`Open ${l.title}`}
                      className="rounded-lg border border-line p-2 text-[#1d6ce0] hover:bg-[#eff6ff]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>
                    </a>
                    <button type="button" title="Edit list" aria-label={`Edit ${l.title}`}
                      onClick={() => setLists((qs) => qs.map((x) => (x.key === l.key ? { ...x, editing: !x.editing } : x)))}
                      className="rounded-lg border border-line p-2 text-muted hover:bg-soft hover:text-ink">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                    </button>
                    <button type="button" title="Delete list" aria-label={`Delete ${l.title}`}
                      onClick={() => setLists((qs) => qs.filter((x) => x.key !== l.key))}
                      className="rounded-lg border border-line p-2 text-[#dc2626] hover:bg-[#fee2e2]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>
                    </button>
                  </div>
                </article>
              ))}
              {!editorOpen && (
                <button type="button" onClick={openEditor}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#16a34a] px-3.5 py-2.5 text-sm font-semibold text-[#16a34a] hover:bg-[#f0fdf4]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  {mode === "individual" ? "Add Problem Link" : "Add Problem List Link"}
                </button>
              )}
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

          <section className="rounded-xl border border-line bg-card p-5" aria-label="Student View Preview">
            <h2 className="text-[17px] font-bold">Student View Preview</h2>
            <div className="mt-2 flex gap-4 border-b border-line text-sm font-semibold" role="tablist" aria-label="Preview tabs">
              {(["desc", "list"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={previewTab === t} onClick={() => setPreviewTab(t)}
                  className={`-mb-px border-b-2 px-1 pb-2 ${previewTab === t ? "border-[#16a34a] text-[#16a34a]" : "border-transparent text-muted hover:text-ink"}`}>
                  {t === "desc" ? "Test Description" : "Problem List"}
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
                  <span>🏆 {totalMarks || "—"} Marks</span>
                  <span>📅 Deadline: {deadline ? fmtDeadline(deadline) : "—"}</span>
                  <span>📄 {attempts === "unlimited" ? "No bound" : `${attempts} Attempt${attempts === "1" ? "" : "s"}`}</span>
                </p>
                <p className="mt-3 text-sm font-bold">Description</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-muted">{description.trim() || "No description yet."}</p>
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
              <div className="mt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{title.trim() || "Untitled test"}</p>
                  {pricing === "paid" && <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">{currencySymbol(currency || 'USD')}{Number(price) || 0}</span>}
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span>☰ {itemCount} Problem List{itemCount === 1 ? "" : "s"}</span>
                  <span>📅 Deadline: {deadline ? fmtDeadline(deadline) : "—"}</span>
                  <span>📄 {attempts === "unlimited" ? "No bound" : `${attempts} Attempt${attempts === "1" ? "" : "s"}`}</span>
                </p>
                <div className="mt-2.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[13px] text-muted dark:bg-infosoft">
                  <span aria-hidden className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1d6ce0] align-text-bottom text-[10px] font-bold text-white">i</span>
                  Open the problem list below to solve the problems on the original platform. You can practice as many times as you want. No file submission is required.
                </div>
                <p className="mt-3 text-sm font-bold">{mode === "list" ? "Problem Lists" : "Problems"}</p>
                <div className="mt-2 space-y-2.5">
                  {mode === "list" ? lists.map((l, i) => (
                    <div key={l.key} className="flex items-start gap-2.5 rounded-lg border border-line p-3">
                      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{i + 1}</span>
                      <PlatformMark url={l.url} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{l.title || "Untitled list"}</p>
                        {l.blurb && <p className="mt-0.5 text-[13px] text-muted">{l.blurb}</p>}
                        {!!l.topics.length && (
                          <p className="mt-1.5 flex flex-wrap gap-1.5">
                            {l.topics.map((t, ti) => (
                              <span key={t} className={`rounded-md px-2 py-0.5 text-xs font-medium ${TAG_TONES[ti % TAG_TONES.length]}`}>{t}</span>
                            ))}
                          </p>
                        )}
                      </div>
                      <a href={l.url} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1d6ce0] px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                        Open List
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>
                      </a>
                    </div>
                  )) : problems.map((p, i) => (
                    <div key={p.key} className="flex items-center gap-2.5 rounded-lg border border-line p-3">
                      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{i + 1}</span>
                      <PlatformMark url={p.url} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.name || "Untitled problem"}</p>
                        {p.topic && <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${TAG_TONES[i % TAG_TONES.length]}`}>{p.topic}</span>}
                      </div>
                      <a href={p.url} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1d6ce0] px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                        Solve
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>
                      </a>
                    </div>
                  ))}
                  {!itemCount && <p className="text-sm text-muted">Add a problem to see it here.</p>}
                </div>
              </div>
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
                ["Number of Problems", String(itemCount)],
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
