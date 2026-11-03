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

interface Criterion { key: string; label: string; marks: string }
type SubType = "zip" | "git" | "live" | "pdf";

const SUB_META: { key: SubType; title: string; body: string; icon: React.ReactNode }[] = [
  {
    key: "zip", title: "ZIP File", body: "Submit a compressed project folder (ZIP).",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ca8a04]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>),
  },
  {
    key: "git", title: "Git Repository Link", body: "Submit a public GitHub, GitLab or Bitbucket link.",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ea580c]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>),
  },
  {
    key: "live", title: "Live Link", body: "Submit a deployed live project link.",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>),
  },
  {
    key: "pdf", title: "PDF File", body: "Submit a PDF document/report.",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5 text-[#dc2626]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></svg>),
  },
];

function fmtDeadline(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export interface ProjectFormInitial {
  examId: string;
  title: string;
  playlistId: string;
  description: string;
  tags: string[];
  pricing: "free" | "paid";
  price: string;
  instructions: string;
  criteria: { label: string; marks: string }[];
  subTypes: SubType[];
  totalMarks: string;
  passingMarks: string;
  deadline: string;
  attempts: string;
  visibility: string;
  status: string;
  videoId: string;
  maxFileSize: string;
  maxFiles: string;
  /** Existing slot question id per submission type (parsed from their rubrics). */
  slotQids: Partial<Record<SubType, string>>;
  /** Full pre-edit question order, so slots we could not parse stay linked instead of being dropped. */
  existingQuestionIds: string[];
}

export function ProjectForm({ initial }: { initial?: ProjectFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);
  const keySeq = useRef(0);
  const newKey = () => `c${Date.now()}_${keySeq.current++}`;
  const instrRef = useRef<HTMLTextAreaElement>(null);

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
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
    initial
      ? initial.criteria.map((c) => ({ key: newKey(), label: c.label, marks: c.marks }))
      : [
        { key: "c1", label: "Functionality", marks: "30" },
        { key: "c2", label: "Code Quality", marks: "20" },
        { key: "c3", label: "UI/UX", marks: "20" },
        { key: "c4", label: "Documentation", marks: "20" },
        { key: "c5", label: "Best Practices", marks: "10" },
      ]);
  const [subTypes, setSubTypes] = useState<SubType[]>(initial?.subTypes ?? ["zip", "git", "live", "pdf"]);

  const [totalMarks, setTotalMarks] = useState(initial?.totalMarks ?? "100");
  const [passingMarks, setPassingMarks] = useState(initial?.passingMarks ?? "60");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "2026-12-31T23:59");
  const [attempts, setAttempts] = useState(initial?.attempts ?? "1");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [videoId, setVideoId] = useState(initial?.videoId ?? "");
  const [maxFileSize, setMaxFileSize] = useState(initial?.maxFileSize ?? "50 MB");
  const [maxFiles, setMaxFiles] = useState(initial?.maxFiles ?? "1");

  const [previewTab, setPreviewTab] = useState<"desc" | "form">("desc");
  const [pvZip, setPvZip] = useState("");
  const [pvPdf, setPvPdf] = useState("");
  const [pvGit, setPvGit] = useState("");
  const [pvLive, setPvLive] = useState("");
  const [pvError, setPvError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);
  const playlistName = (playlists.data?.items ?? []).find((p) => p._id === playlistId)?.title ?? "";

  const totalNum = Number(totalMarks);
  const passNum = Number(passingMarks);
  const criteriaSum = criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0);
  const requirementLines = instructions.split("\n").map((l) => l.trim()).filter(Boolean);
  const toggleSub = (k: SubType) =>
    setSubTypes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const subLabel = (k: SubType) => (k === "zip" ? "ZIP" : k === "git" ? "Git Link" : k === "live" ? "Live Link" : "PDF");

  const wrapSelection = (before: string, after = "") => {
    const el = instrRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    setInstructions(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
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
    if (pricing === "paid") { const pe = checkPrice(price); if (pe) { setError(pe); return; } if (!currency) { setError("Currency is required for a paid project — choose a currency."); return; } }
    if (!instructions.trim()) { setError("Project instructions are required."); return; }
    if (!criteria.length) { setError("Add at least one mark distribution criterion."); return; }
    if (criteria.some((c) => !c.label.trim())) { setError("Every criterion needs a name."); return; }
    { const bad = criteria.findIndex((c) => c.marks.trim() === "" || !Number.isFinite(Number(c.marks)) || Number(c.marks) < 0); if (bad >= 0) { setError(`Criterion ${bad + 1} marks must be 0 or more.`); return; } }
    if (criteriaSum !== totalNum) { setError(`Criteria marks add up to ${criteriaSum}, but total marks is ${totalNum}. Make them match.`); return; }
    if (!subTypes.length) { setError("Select at least one allowed submission type."); return; }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      const fullDescription = [
        description.trim(),
        "",
        "Project instructions:",
        instructions.trim(),
        "",
        `Mark distribution (total ${totalNum}):`,
        ...criteria.map((c) => `- ${c.label.trim()}: ${c.marks}`),
        "",
        `Allowed submissions: ${subTypes.map(subLabel).join(", ")} · Max file size ${maxFileSize} · Max files ${maxFiles} · Attempts ${attempts === "unlimited" ? "No bound" : attempts} · Passing ${passingMarks}/${totalMarks}`,
        playlistId ? `Playlist: ${playlistName || playlistId}` : "",
      ].filter((l) => l !== undefined).join("\n").trim();
      // Projects live in the Exams collection (kind="project"), like every other test.
      // Each allowed submission slot (ZIP/Git/Live/PDF link or file) is stored as a
      // Question; students answer those questions with their links/files via attempts.
      // Edit mode: update existing slot questions, create new ones, delete removed slots.
      const slotMeta: Record<SubType, { title: string; type: "short" | "code"; hint: string }> = {
        zip: { title: "ZIP File", type: "code", hint: "Upload the compressed project folder (.zip)." },
        git: { title: "Git Repository Link", type: "short", hint: "Paste the public GitHub/GitLab/Bitbucket repository URL." },
        live: { title: "Live Link", type: "short", hint: "Paste the deployed live project URL." },
        pdf: { title: "PDF File", type: "code", hint: "Upload the PDF document/report (.pdf)." },
      };
      const share = Math.floor(totalNum / subTypes.length);
      const slotPayload = (key: SubType, marks: number) => {
        const meta = slotMeta[key];
        return {
          title: `${meta.title} — ${title.trim().slice(0, 150)}`.slice(0, 200),
          description: `Project submission slot: ${subLabel(key)}`,
          tags,
          visibility,
          status: nextStatus,
          price: 0,
          currency: defaultCurrency,
          type: meta.type,
          prompt: `${meta.title} submission for "${title.trim()}"\n${meta.hint}\n\nProject instructions:\n${instructions.trim()}`,
          answer: "",
          rubric: `submissionType:${key}\nMax file size ${maxFileSize} · Max files ${maxFiles}\n\nMark distribution (total ${totalNum}):\n${criteria.map((c) => `- ${c.label.trim()}: ${c.marks}`).join("\n")}`,
          linkedContentId: null,
          options: [],
          correctOptions: [],
          multiple: false,
          marks,
          explanation: "",
        };
      };
      const ids: string[] = [];
      let skipped = 0;
      for (let i = 0; i < subTypes.length; i++) {
        const key = subTypes[i]!;
        const marks = i === subTypes.length - 1 ? totalNum - share * (subTypes.length - 1) : share;
        const existing = isEdit ? initial!.slotQids[key] : undefined;
        if (existing) {
          try {
            await apiPatch(`/api/v1/questions/${existing}`, slotPayload(key, marks));
          } catch (e) {
            if (e instanceof ApiError && e.status === 403) { skipped++; }
            else throw e;
          }
          ids.push(existing);
        } else {
          const created = await apiPost<{ _id: string }>("/api/v1/questions", slotPayload(key, marks));
          ids.push(created._id);
        }
      }
      if (isEdit) {
        const kept = new Set(ids);
        for (const qid of Object.values(initial!.slotQids)) {
          if (!qid || kept.has(qid)) continue;
          await apiDelete(`/api/v1/questions/${qid}`).catch((e) => {
            if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return;
            throw e;
          });
        }
      }
      // Keep pre-existing questions we could not parse as slots (unknown
      // format): dropping them from questionIds would silently orphan content.
      const parsedQids = new Set(Object.values(initial?.slotQids ?? {}).filter(Boolean));
      const preserved = ((initial?.existingQuestionIds ?? []) as string[]).filter(
        (qid) => !parsedQids.has(qid) && !ids.includes(qid),
      );
      const finalIds = [...ids, ...preserved];
      const payload = {
        title: title.trim(),
        description: fullDescription,
        tags,
        visibility,
        status: nextStatus,
        price: pricing === "paid" ? Number(price) : 0,
        currency: currency || defaultCurrency,
        questionIds: finalIds,
        ...(isEdit ? {} : { durationMinutes: 1440 }),
        maxAttempts: att,
        accessPolicy: pricing === "paid" ? "paid" : "free",
        passingMarks: passNum,
        maxScore: totalNum,
        playlistId: playlistId || null,
        endsAt: new Date(deadline).toISOString(),
        // Extended project fields (stored on the Exam for kind="project"):
        rubric: criteria.map((c) => ({ label: c.label.trim(), marks: Number(c.marks) || 0 })),
        submissionTypes: subTypes, maxFileSize, maxFiles: Number(maxFiles) || 1,
        videoId: videoId.trim(),
        kind: "project",
      };
      if (isEdit) {
        await apiPatch(`/api/v1/exams/${initial!.examId}`, payload);
        toast(skipped ? `Project updated. ${skipped} shared slot(s) kept unchanged.` : "Project updated.");
      } else {
        await apiPost("/api/v1/exams", payload);
        toast(nextStatus === "published" ? "Project published." : "Project saved as draft.");
      }
      router.push("/teacher/exams");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the project.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={isEdit ? "/teacher/exams" : "/teacher/exams/new"} className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;{isEdit ? "Back to All Tests" : "Back to Test Types"}</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1eafe] text-[#7c3aed]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{isEdit ? "Edit Project Test" : "Create Project Test"}</h1>
          <p className="text-[15px] text-muted">{isEdit ? "Update every part of this project — details, requirements, pricing, and settings." : "Create a project-based test where students complete and submit their work."}</p>
        </div>
      </div>

      {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Basic information */}
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
                    {p === "free" ? "Free Project" : "Paid Project"}
                  </span>
                  <span className="mt-0.5 block pl-7 text-[13px] text-muted">{p === "free" ? "Students can take this project for free." : "Set a price to sell this project."}</span>
                </button>
              ))}
            </div>
            {pricing === "paid" && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Price ({currency || defaultCurrency})</Label>
                  <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Set amount" className={inputCls} />
                  <p className="mt-1.5 text-[13px] text-muted">Set a price for this project. Students need to purchase to access the project.</p>
                </div>
                <div>
                  <Label required>Currency</Label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}><option value="" disabled>Set currency</option>{currencies.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}</select>
                </div>
              </div>
            )}
          </section>

          {/* Project requirements */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Project Requirements">
            <h2 className="text-[17px] font-bold">Project Requirements</h2>
            <div className="mt-3">
              <Label required>Project Instructions</Label>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-1 border-b border-line bg-soft px-2 py-1.5" role="toolbar" aria-label="Formatting">
                  <select aria-label="Paragraph style" className="rounded-md bg-transparent px-2 py-1 text-sm" onChange={() => undefined} value="Paragraph">
                    <option>Paragraph</option><option>Heading</option>
                  </select>
                  {[
                    { label: "Bold", b: "**", cls: "font-bold", ch: "B" },
                    { label: "Italic", b: "*", cls: "italic", ch: "I" },
                    { label: "Underline", b: "__", cls: "underline", ch: "U" },
                  ].map((t) => (
                    <button key={t.label} type="button" title={t.label} aria-label={t.label} onClick={() => wrapSelection(t.b, t.b)}
                      className={`rounded-md px-2 py-1 text-sm hover:bg-card ${t.cls}`}>{t.ch}</button>
                  ))}
                  {[
                    { label: "Bullet list", ins: "\n- " },
                    { label: "Numbered list", ins: "\n1. " },
                    { label: "Link", ins: "[text](https://…)" },
                    { label: "Code", ins: "`code`" },
                  ].map((t) => (
                    <button key={t.label} type="button" title={t.label} aria-label={t.label}
                      onClick={() => setInstructions((v) => v + t.ins)}
                      className="rounded-md px-2 py-1 text-sm text-muted hover:bg-card hover:text-ink">{t.label === "Bullet list" ? "☰" : t.label === "Numbered list" ? "☰" : t.label === "Link" ? "🔗" : "<>"}</button>
                  ))}
                </div>
                <textarea ref={instrRef} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} maxLength={5000}
                  placeholder="set requirements here" className="w-full bg-card px-3.5 py-2.5 text-[15px] outline-none" />
              </div>
              <p className="mt-1 text-right text-xs text-muted">{instructions.length}/5000</p>
            </div>

            <h3 className="mt-4 text-[16px] font-bold">Mark Distribution Criteria</h3>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[1fr_140px_28px] items-center gap-2 text-sm font-medium">
                <span>Criteria</span><span>Marks <span aria-hidden className="text-danger">*</span></span><span />
              </div>
              {criteria.map((c) => (
                <div key={c.key} className="grid grid-cols-[1fr_140px_28px] items-center gap-2">
                  <input value={c.label} onChange={(e) => setCriteria((cs) => cs.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x)))}
                    placeholder="e.g. Functionality" maxLength={100} className={inputCls} aria-label="Criterion name" />
                  <input type="number" min={0} value={c.marks} onChange={(e) => setCriteria((cs) => cs.map((x) => (x.key === c.key ? { ...x, marks: e.target.value } : x)))}
                    className={inputCls} aria-label={`Marks for ${c.label || "criterion"}`} />
                  <button type="button" aria-label={`Remove ${c.label || "criterion"}`} onClick={() => setCriteria((cs) => cs.filter((x) => x.key !== c.key))}
                    className="rounded-md p-1 text-muted hover:bg-soft hover:text-danger">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setCriteria((cs) => [...cs, { key: newKey(), label: "", marks: "" }])}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#16a34a] px-3.5 py-2.5 text-sm font-semibold text-[#16a34a] hover:bg-[#f0fdf4]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add Criteria
              </button>
              <p className={`text-xs ${criteriaSum === totalNum ? "text-muted" : "font-medium text-danger"}`}>
                Criteria total: {criteriaSum} / {totalMarks || "—"} marks{criteriaSum !== totalNum ? " — must match Total Marks." : ""}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-[#16a34a] p-4">
              <p className="text-sm font-semibold">Allowed Submission Types <span aria-hidden className="text-danger">*</span></p>
              <p className="text-[13px] text-muted">Select one or more file types that students can submit.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SUB_META.map((s) => {
                  const on = subTypes.includes(s.key);
                  return (
                    <button key={s.key} type="button" role="checkbox" aria-checked={on} onClick={() => toggleSub(s.key)} className="text-left">
                      <span className="flex items-center gap-1.5 text-[13px] font-bold">
                        <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-[#16a34a] bg-[#16a34a] text-white" : "border-line text-transparent"}`}>
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                        </span>
                        {s.icon}{s.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{s.body}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Project Settings">
            <h2 className="text-[17px] font-bold">Project Settings</h2>
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
                <p className="mt-1 text-xs text-muted">Who can take this project.</p>
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

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="File Upload Settings">
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
                <p className="mt-1 text-xs text-muted">Number of files a student can upload</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Student View Preview">
            <h2 className="text-[17px] font-bold">Student View Preview</h2>
            <div className="mt-2 flex gap-4 border-b border-line text-sm font-semibold" role="tablist" aria-label="Preview tabs">
              {(["desc", "form"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={previewTab === t} onClick={() => setPreviewTab(t)}
                  className={`-mb-px border-b-2 px-1 pb-2 ${previewTab === t ? "border-[#16a34a] text-[#16a34a]" : "border-transparent text-muted hover:text-ink"}`}>
                  {t === "desc" ? "Project Description" : "Submission Form"}
                </button>
              ))}
            </div>

            {previewTab === "desc" ? (
              <div className="mt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{title.trim() || "Untitled project"}</p>
                  {pricing === "paid" && <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">{currencySymbol(currency || 'USD')}{Number(price) || 0}</span>}
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span>◷ {totalMarks || "—"} Marks</span>
                  <span>📅 Deadline: {deadline ? fmtDeadline(deadline) : "—"}</span>
                  <span>👤 {attempts === "unlimited" ? "No bound" : `${attempts} Attempt${attempts === "1" ? "" : "s"}`}</span>
                </p>
                <p className="mt-2 text-[13px] text-muted">{description.trim() || "No description yet."}</p>
                <p className="mt-3 text-sm font-bold">Requirements:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted">
                  {requirementLines.length ? requirementLines.map((l, i) => <li key={i}>{l.replace(/^\d+[.)]\s*/, "")}</li>) : <li>No requirements yet.</li>}
                </ul>
              </div>
            ) : (
              <form className="mt-3" noValidate onSubmit={(e) => {
                e.preventDefault();
                setPvError("");
                const missing: string[] = [];
                if (subTypes.includes("zip") && !pvZip) missing.push("ZIP File");
                if (subTypes.includes("git") && !pvGit.trim()) missing.push("Git Repository Link");
                if (subTypes.includes("live") && !pvLive.trim()) missing.push("Live Link");
                if (subTypes.includes("pdf") && !pvPdf) missing.push("PDF File");
                if (missing.length) { setPvError(`Please complete all required fields: ${missing.join(", ")}.`); return; }
                toast("Preview submit OK — all required fields are filled. Students submit from their own view.");
              }}>
                <p className="font-bold">Submit Your Project</p>
                <p className="text-[13px] text-muted">Upload your project files or provide links as allowed by the teacher. All fields below are required.</p>
                {pvError && <p role="alert" className="mt-2 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{pvError}</p>}
                <div className="mt-2 space-y-2.5">
                  {SUB_META.filter((m) => subTypes.includes(m.key)).map((m, i) => (
                    <div key={m.key} className="rounded-lg bg-soft p-3">
                      {m.key === "zip" && (
                        <>
                          <p className="text-[13px] font-semibold">🗎 {i + 1}. ZIP File <span aria-hidden className="text-danger">*</span></p>
                          <label className="mt-1.5 block cursor-pointer rounded-lg border border-dashed border-[#93c5fd] bg-card px-3 py-3 text-center">
                            <span className="block text-sm font-semibold text-[#1d6ce0]">☁ Click to upload or drag and drop</span>
                            <span className="block text-xs text-muted">Only .zip files are allowed (Max {maxFileSize}){pvZip ? ` — selected: ${pvZip}` : ""}</span>
                            <input type="file" accept=".zip" required aria-required="true" aria-label="ZIP File (required)" className="hidden"
                              onChange={(e) => setPvZip(e.target.files?.[0]?.name ?? "")} />
                          </label>
                        </>
                      )}
                      {m.key === "git" && (
                        <>
                          <p className="text-[13px] font-semibold">🔶 {i + 1}. Git Repository Link <span aria-hidden className="text-danger">*</span></p>
                          <p className="text-xs text-muted">Enter your GitHub, GitLab or Bitbucket repository link</p>
                          <input value={pvGit} onChange={(e) => setPvGit(e.target.value)} required aria-required="true"
                            placeholder="Example: https://github.com/username/project" aria-label="Git Repository Link (required)"
                            className={`${inputCls} mt-1.5 bg-card`} />
                        </>
                      )}
                      {m.key === "live" && (
                        <>
                          <p className="text-[13px] font-semibold">🔗 {i + 1}. Live Link <span aria-hidden className="text-danger">*</span></p>
                          <p className="text-xs text-muted">Enter your deployed project link</p>
                          <input value={pvLive} onChange={(e) => setPvLive(e.target.value)} required aria-required="true"
                            placeholder="Example: https://your-project.vercel.app" aria-label="Live Link (required)"
                            className={`${inputCls} mt-1.5 bg-card`} />
                        </>
                      )}
                      {m.key === "pdf" && (
                        <>
                          <p className="text-[13px] font-semibold">📕 {i + 1}. PDF File <span aria-hidden className="text-danger">*</span></p>
                          <label className="mt-1.5 block cursor-pointer rounded-lg border border-dashed border-[#93c5fd] bg-card px-3 py-3 text-center">
                            <span className="block text-sm font-semibold text-[#1d6ce0]">☁ Click to upload or drag and drop</span>
                            <span className="block text-xs text-muted">Only .pdf files are allowed (Max {maxFileSize}){pvPdf ? ` — selected: ${pvPdf}` : ""}</span>
                            <input type="file" accept=".pdf" required aria-required="true" aria-label="PDF File (required)" className="hidden"
                              onChange={(e) => setPvPdf(e.target.files?.[0]?.name ?? "")} />
                          </label>
                        </>
                      )}
                    </div>
                  ))}
                  {!subTypes.length && <p className="text-sm text-muted">Select a submission type to see the form.</p>}
                </div>
                <button type="submit"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">
                  ➤ Submit Project
                </button>
              </form>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Project Summary">
            <h2 className="text-[17px] font-bold">Project Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Total Marks", totalMarks || "—"],
                ["Passing Marks", `${passingMarks || "—"} (${passNum || 0}%)`],
                ["Price", pricing === "paid" ? `${Number(price) || 0} ${currency || defaultCurrency}` : "Free"],
                ["Deadline", deadline ? fmtDeadline(deadline) : "—"],
                ["Allowed Submission Types", subTypes.map(subLabel).join(", ") || "—"],
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
              {busy === "publish" ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save & Publish" : "Publish Project"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
