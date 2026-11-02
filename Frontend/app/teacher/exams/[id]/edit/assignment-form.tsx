"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Notice, useToast } from "@/components/ui";
import { apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Page, Playlist } from "@/lib/types";

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

export interface AssignmentProjectFormInitial {
  assignmentId: string;
  title: string;
  playlistId: string;
  description: string;
  tags: string[];
  pricing: "free" | "paid";
  price: string;
  visibility: string;
  status: string;
  videoId: string;
  dueAt: string;
  maxScore: string;
  maxAttempts: string;
  passingMarks: string;
  maxFileSize: string;
  maxFiles: string;
  subTypes: SubType[];
  criteria: { label: string; marks: string }[];
}

/** Project-styled edit page for assignment-format project tests: the same
 *  sections as Create Project Test, wired to the assignment endpoint. */
export function AssignmentProjectForm({ initial }: { initial: AssignmentProjectFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const keySeq = useRef(0);
  const newKey = () => `c${Date.now()}_${keySeq.current++}`;

  const [title, setTitle] = useState(initial.title);
  const [playlistId, setPlaylistId] = useState(initial.playlistId);
  const [description, setDescription] = useState(initial.description);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [pricing, setPricing] = useState<"free" | "paid">(initial.pricing);
  const [price, setPrice] = useState(initial.price);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [status, setStatus] = useState(initial.status);
  const [videoId, setVideoId] = useState(initial.videoId);
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [maxScore, setMaxScore] = useState(initial.maxScore);
  const [maxAttempts, setMaxAttempts] = useState(initial.maxAttempts);
  const [passingMarks, setPassingMarks] = useState(initial.passingMarks);
  const [maxFileSize, setMaxFileSize] = useState(initial.maxFileSize);
  const [maxFiles, setMaxFiles] = useState(initial.maxFiles);
  const [subTypes, setSubTypes] = useState<SubType[]>(initial.subTypes);
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
    initial.criteria.length
      ? initial.criteria.map((c) => ({ key: newKey(), label: c.label, marks: c.marks }))
      : [{ key: newKey(), label: "", marks: "" }]);
  const [previewTab, setPreviewTab] = useState<"desc" | "form">("desc");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);

  const totalNum = Number(maxScore);
  const passNum = Number(passingMarks);
  const passPct = totalNum > 0 ? Math.round((passNum / totalNum) * 100) : 0;
  const criteriaSum = criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0);
  const criteriaUsed = criteria.some((c) => c.label.trim() || (c.marks.trim() !== ""));
  const requirementLines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const toggleSub = (k: SubType) =>
    setSubTypes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const subLabel = (k: SubType) => (k === "zip" ? "ZIP" : k === "git" ? "Git Link" : k === "live" ? "Live Link" : "PDF");

  const save = async (nextStatus: "draft" | "published") => {
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (!Number.isInteger(totalNum) || totalNum < 1 || totalNum > 10000) { setError("Total marks must be between 1 and 10000."); return; }
    if (!(passNum >= 0 && passNum <= totalNum)) { setError(`Passing marks must be between 0 and ${maxScore}.`); return; }
    const att = maxAttempts === "unlimited" ? null : Number(maxAttempts);
    if (att !== null && (!Number.isInteger(att) || att < 1 || att > 20)) { setError("Attempts allowed must be 1–20 or No bound."); return; }
    if (pricing === "paid" && !(Number(price) > 0)) { setError("Set a price above 0 for a paid project (or choose Free Project)."); return; }
    if (criteriaUsed) {
      if (criteria.some((c) => !c.label.trim())) { setError("Every criterion needs a name."); return; }
      if (criteriaSum !== totalNum) { setError(`Criteria marks add up to ${criteriaSum}, but total marks is ${totalNum}. Make them match.`); return; }
    }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      await apiPatch(`/api/v1/assignments/${initial.assignmentId}`, {
        title: title.trim(), description, tags,
        visibility, status: nextStatus,
        price: pricing === "paid" ? Number(price) : 0, currency: "BDT",
        videoId: videoId.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxScore: totalNum, maxAttempts: att,
        passingMarks: passNum,
        playlistId: playlistId || null,
        submissionTypes: subTypes,
        maxFileSize, maxFiles: Number(maxFiles) || 1,
        rubric: criteriaUsed ? criteria.map((c) => ({ label: c.label.trim(), marks: Number(c.marks) || 0 })) : [],
      });
      toast("Project updated.");
      router.push("/teacher/exams");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the project.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href="/teacher/exams" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to All Tests</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1eafe] text-[#7c3aed]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Edit Project Test</h1>
          <p className="text-[15px] text-muted">Update every part of this project — details, requirements, pricing, and settings.</p>
        </div>
      </div>

      {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Basic Information">
            <h2 className="text-[17px] font-bold">Basic Information</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Title</Label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Build a To-Do App with React" className={inputCls} />
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
                placeholder="Describe the project for students." className={inputCls} />
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
                    {p === "free" ? "Free Project" : "Paid Project"}
                  </span>
                  <span className="mt-0.5 block pl-7 text-[13px] text-muted">{p === "free" ? "Students can take this project for free." : "Set a price to sell this project."}</span>
                </button>
              ))}
            </div>
            {pricing === "paid" && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Price (BDT)</Label>
                  <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="300" className={inputCls} />
                  <p className="mt-1.5 text-[13px] text-muted">Set a price for this project. Students need to purchase to access the project.</p>
                </div>
                <div>
                  <Label required>Currency</Label>
                  <select value="BDT" onChange={() => undefined} className={inputCls}><option value="BDT">BDT (৳)</option></select>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Project Requirements">
            <h2 className="text-[17px] font-bold">Project Requirements</h2>
            <p className="mt-1 text-sm text-muted">Grade students against these criteria. Leave the table empty if this project has no fixed criteria.</p>

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
              <p className={`text-xs ${!criteriaUsed || criteriaSum === totalNum ? "text-muted" : "font-medium text-danger"}`}>
                Criteria total: {criteriaSum} / {maxScore || "—"} marks{criteriaUsed && criteriaSum !== totalNum ? " — must match Total Marks." : ""}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-[#16a34a] p-4">
              <p className="text-sm font-semibold">Allowed Submission Types</p>
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

        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-card p-5" aria-label="Project Settings">
            <h2 className="text-[17px] font-bold">Project Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label required>Total Marks</Label>
                <input type="number" min={1} max={10000} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label required>Passing Marks</Label>
                <input type="number" min={0} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label optional>Deadline</Label>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label required>Attempts Allowed</Label>
                <select value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className={inputCls}>
                  {["1", "2", "3", "4", "5", "10", "20"].map((n) => <option key={n} value={n}>{n}</option>)}
                  {!["1", "2", "3", "4", "5", "10", "20", "unlimited"].includes(maxAttempts) && <option value={maxAttempts}>{maxAttempts}</option>}
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

          <section className="rounded-xl border border-line bg-card p-5" aria-label="File Upload Settings">
            <h2 className="text-[17px] font-bold">File Upload Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label optional>Maximum File Size</Label>
                <select value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} className={inputCls}>
                  {["", "5 MB", "10 MB", "25 MB", "50 MB", "100 MB"].map((n) => <option key={n} value={n}>{n || "Not set"}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">Maximum size per file.</p>
              </div>
              <div>
                <Label optional>Maximum Files</Label>
                <select value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} className={inputCls}>
                  {["1", "2", "3", "5", "10"].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">Number of files a student can upload</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5" aria-label="Student View Preview">
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
                  {pricing === "paid" && <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">{Number(price) || 0}৳</span>}
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span>◷ {maxScore || "—"} Marks</span>
                  <span>📅 Deadline: {dueAt ? fmtDeadline(dueAt) : "—"}</span>
                  <span>👤 {maxAttempts === "unlimited" ? "No bound" : `${maxAttempts} Attempt${maxAttempts === "1" ? "" : "s"}`}</span>
                </p>
                <p className="mt-2 whitespace-pre-line text-[13px] text-muted">{description.trim() || "No description yet."}</p>
                {!!requirementLines.length && (
                  <>
                    <p className="mt-3 text-sm font-bold">Requirements:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted">
                      {requirementLines.map((l, i) => <li key={i}>{l.replace(/^\d+[.)]\s*/, "")}</li>)}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="font-bold">Submit Your Project</p>
                <p className="text-[13px] text-muted">Upload your project files or provide links as allowed by the teacher.</p>
                <div className="mt-2 space-y-2.5">
                  {SUB_META.filter((m) => subTypes.includes(m.key)).map((m, i) => (
                    <div key={m.key} className="rounded-lg bg-soft p-3">
                      <p className="text-[13px] font-semibold">{i + 1}. {m.title}</p>
                      <p className="text-xs text-muted">{m.body} (Max {maxFileSize || "—"})</p>
                    </div>
                  ))}
                  {!subTypes.length && <p className="text-sm text-muted">Select a submission type to see the form.</p>}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5" aria-label="Project Summary">
            <h2 className="text-[17px] font-bold">Project Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Total Marks", maxScore || "—"],
                ["Passing Marks", `${passingMarks || "—"} (${passPct}%)`],
                ["Price", pricing === "paid" ? `${Number(price) || 0} BDT` : "Free"],
                ["Deadline", dueAt ? fmtDeadline(dueAt) : "—"],
                ["Allowed Submission Types", subTypes.map(subLabel).join(", ") || "—"],
                ["Max File Size", maxFileSize || "—"],
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
              {busy === "publish" ? "Saving…" : "Save & Publish"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
