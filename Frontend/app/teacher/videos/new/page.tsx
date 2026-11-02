"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Notice, useToast } from "@/components/ui";
import { apiPost, apiUpload, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { UploadDoc } from "@/lib/types";

type Source = "youtube" | "upload";
const MAX_MP4_BYTES = 10 * 1024 * 1024; // server MAX_UPLOAD_SIZE_MB
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const inputCls =
  "w-full rounded-lg border border-line bg-card px-3.5 py-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[15px] font-medium">
      {children} {required && <span aria-hidden className="text-danger">*</span>}
    </span>
  );
}

function TagsInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const t = draft.trim().replace(/,+$/, "");
              if (t && !value.includes(t) && value.length < 20) onChange([...value, t]);
              setDraft("");
            }
          }}
          placeholder="Add tags and press Enter..." aria-label="Add tags and press Enter"
          className={inputCls} />
      </div>
      {!!value.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-sm font-medium">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted hover:text-danger">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceCard({ active, onClick, icon, title, body }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={`flex flex-1 items-start gap-3 rounded-xl border bg-card p-4 text-left transition ${active ? "border-[#22c55e] bg-[#f0fdf4] dark:bg-brandsoft" : "border-line hover:border-muted"}`}>
      <span aria-hidden className={active ? "text-[#16a34a]" : "text-muted"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{body}</span>
      </span>
      <span aria-hidden className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[#16a34a]" : "border-line"}`}>
        {active && <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />}
      </span>
    </button>
  );
}

const linkIcon = (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
);
const cloudIcon = (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4.5 4.5 0 1 1 .8-8.9A5.5 5.5 0 0 1 18.6 10H18a3.5 3.5 0 0 1 .5 7" /><path d="M12 12v7M9 15l3-3 3 3" /></svg>
);

export default function CreateVideoPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [source, setSource] = useState<Source>("youtube");
  const [youtubeId, setYoutubeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("public");
  const [status, setStatus] = useState("published");
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ytValid = YT_ID.test(youtubeId.trim());

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = async (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".mp4")) { setError("Only MP4 files are accepted — the server verifies the file's real type and rejects everything else."); return; }
    if (f.size === 0) { setError("This file is empty (0 bytes). Pick a complete video file."); return; }
    if (f.size > MAX_MP4_BYTES) { setError(`This file is ${(f.size / 1048576).toFixed(1)} MB. The server limit is 10 MB — compress or trim the video first.`); return; }
    // Instant magic-byte sniff: every real MP4 starts with a box size + "ftyp".
    // Renamed .mkv/.avi/.mov/.webm files fail here instead of after a slow upload.
    try {
      const head = new Uint8Array(await f.slice(0, 12).arrayBuffer());
      const box = String.fromCharCode(head[4] ?? 0, head[5] ?? 0, head[6] ?? 0, head[7] ?? 0);
      if (box !== "ftyp") {
        setError("This file is not a real MP4 (its first bytes are not an MP4 header). It may be a renamed .mkv, .avi, .mov or an incomplete download — re-export it as MP4 and try again.");
        return;
      }
    } catch {
      setError("Could not read this file. Try picking it again.");
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (source === "youtube" && !ytValid) { setError("Enter a valid 11-character YouTube video ID."); return; }
    if (source === "upload" && !file) { setError("Choose an MP4 file to upload."); return; }
    if (source === "upload" && pricing === "paid" && !(Number(price) > 0)) { setError("Set a price above 0 for a paid video (or choose Free)."); return; }

    setBusy(true);
    try {
      let assetUploadId: string | null = null;
      if (source === "upload" && file) {
        setUploadPct("Uploading file…");
        const doc = await apiUpload<UploadDoc>("/api/v1/uploads/content", file);
        assetUploadId = doc._id;
        setUploadPct(null);
      }
      await apiPost("/api/v1/videos", {
        title: title.trim(), description, tags,
        visibility, status,
        price: source === "youtube" ? 0 : pricing === "paid" ? Math.max(0, Number(price) || 0) : 0,
        currency: "BDT",
        sourceType: source,
        youtubeId: source === "youtube" ? youtubeId.trim() : "",
        assetUploadId,
      });
      toast(source === "upload" && status === "published" ? "Video created. Students can access it once its file scan clears." : "Video created.");
      router.push("/teacher/videos");
    } catch (err) {
      setUploadPct(null);
      setError(err instanceof ApiError
        ? `Upload failed (${err.status}): ${err.message}`
        : "Could not create the video. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/teacher/videos" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Videos</Link>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight sm:text-[32px]">Create Video</h1>
          <p className="mt-1 max-w-3xl text-[15px] text-muted">Add a video to your channel. You can upload your own video or add a YouTube video using its video ID.</p>
        </div>
        <Link href="/teacher/videos" className="hidden shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium sm:inline-flex">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2.2" /></svg>
          View Your Videos
        </Link>
      </div>

      <form onSubmit={submit} className="mt-5 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Video source">
            <SourceCard active={source === "youtube"} onClick={() => setSource("youtube")} icon={linkIcon}
              title="YouTube Video" body="Add a video from YouTube using the video ID. This will be free for all students." />
            <SourceCard active={source === "upload"} onClick={() => setSource("upload")} icon={cloudIcon}
              title="Own Video (Upload)" body="Upload your own video file. You can set a price for this video." />
          </div>

          {error && <Notice tone="red">{error}</Notice>}

          {source === "youtube" ? (
            <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="YouTube Video Details">
              <h2 className="text-lg font-bold">YouTube Video Details</h2>
              <div className="mt-4">
                <Label required>YouTube Video ID</Label>
                <div className="relative">
                  <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value.trimStart())} placeholder="xzVPcdWLPqw"
                    aria-describedby="yt-help" className={`${inputCls} pr-11`} />
                  {youtubeId && (
                    <span aria-hidden className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xl ${ytValid ? "text-[#16a34a]" : "text-muted"}`}>
                      {ytValid ? "✓" : "…"}
                    </span>
                  )}
                </div>
                <p id="yt-help" className="mt-1.5 text-[13px] leading-snug text-muted">
                  Enter the YouTube video ID (e.g. xzVPcdWLPqw).<br />
                  You can get the ID from a YouTube URL like https://www.youtube.com/watch?v=xzVPcdWLPqw.
                </p>
              </div>

              {ytValid && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4 dark:bg-brandsoft">
                  <span aria-hidden className="text-[#16a34a]">{linkIcon}</span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#16a34a]">Valid video ID</p>
                    <p className="text-sm text-muted">The preview on the right is loaded live from YouTube.</p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label required>Title</Label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
                <p className="mt-1 text-right text-xs text-muted">{title.length}/200</p>
              </div>
              <div className="mt-2">
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000}
                  placeholder="Write a description for your video..." className={inputCls} />
                <p className="mt-1 text-right text-xs text-muted">{description.length}/5000</p>
              </div>
              <div className="mt-2">
                <Label>Tags</Label>
                <TagsInput value={tags} onChange={setTags} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Visibility</Label>
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputCls}>
                    <option value="public">🌐 Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                  <p className="mt-1.5 text-[13px] text-muted">Who can view this video.</p>
                </div>
                <div>
                  <Label required>Status</Label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                    <option value="published">▷ Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-[#f0f6ff] p-4 text-sm dark:bg-infosoft">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f80ed] text-xs font-bold text-white">i</span>
                <p className="text-muted"><span className="font-medium text-ink">YouTube videos are always free for students.</span><br />You cannot set a price for YouTube videos.</p>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-line bg-card p-5 sm:p-6" aria-label="Upload Video">
              <h2 className="text-lg font-bold">Upload Video</h2>
              <button type="button" onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`mt-4 flex w-full flex-col items-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${dragOver ? "border-[#16a34a] bg-[#f0fdf4]" : "border-line bg-soft/60 hover:border-muted"}`}>
                <span aria-hidden className="text-muted">{cloudIcon}</span>
                <span className="mt-2 text-[15px] font-semibold">{file ? file.name : "Drag and drop your video file here"}</span>
                <span className="text-sm text-muted">or click to browse</span>
                <span className="mt-3 text-xs text-muted">Supported format: MP4 (verified by file content) &nbsp;|&nbsp; Max size: 10 MB (server limit)</span>
              </button>
              <input ref={fileRef} type="file" accept=".mp4,video/mp4" className="sr-only" aria-label="Choose an MP4 file"
                onChange={(e) => pickFile(e.target.files?.[0])} />
              {uploadPct && <p className="mt-2 text-sm font-medium text-muted" role="status">{uploadPct}</p>}

              <div className="mt-4">
                <Label required>Title</Label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="My React Tutorial" className={inputCls} />
                <p className="mt-1 text-right text-xs text-muted">{title.length}/200</p>
              </div>
              <div className="mt-2">
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000}
                  placeholder="Write a description for your video..." className={inputCls} />
                <p className="mt-1 text-right text-xs text-muted">{description.length}/5000</p>
              </div>
              <div className="mt-2">
                <Label>Tags</Label>
                <TagsInput value={tags} onChange={setTags} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label required>Pricing</Label>
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pricing">
                    {(["free", "paid"] as const).map((p) => (
                      <button key={p} type="button" role="radio" aria-checked={pricing === p} onClick={() => setPricing(p)}
                        className={`rounded-xl border p-3.5 text-left ${pricing === p ? "border-[#16a34a] bg-[#f0fdf4] dark:bg-brandsoft" : "border-line"}`}>
                        <span className="flex items-center gap-2 text-[15px] font-semibold">
                          <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${pricing === p ? "border-[#16a34a]" : "border-line"}`}>
                            {pricing === p && <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />}
                          </span>
                          {p === "free" ? "Free Video" : "Paid Video"}
                        </span>
                        <span className="mt-0.5 block pl-7 text-[13px] text-muted">{p === "free" ? "Students can watch it for free." : "Set a price to sell this video."}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {pricing === "paid" && (
                  <>
                    <div>
                      <Label required>Price (BDT)</Label>
                      <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="300" className={inputCls} />
                    </div>
                    <div>
                      <Label required>Currency</Label>
                      <select value="BDT" onChange={() => undefined} aria-label="Currency" className={inputCls}>
                        <option value="BDT">BDT (₳)</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <Label required>Visibility</Label>
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputCls}>
                    <option value="public">🌐 Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                  <p className="mt-1.5 text-[13px] text-muted">Who can view this video.</p>
                </div>
                <div>
                  <Label required>Status</Label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                    <option value="published">▷ Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/teacher/videos" className="rounded-lg border border-line bg-card px-6 py-2.5 text-sm font-semibold hover:bg-soft">Cancel</Link>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
              {busy ? "Creating…" : "Create Video"}
            </button>
          </div>
        </div>

        {/* preview column */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          <section className="rounded-xl border border-line bg-card p-5" aria-label="Video Preview">
            <h2 className="text-lg font-bold">Video Preview</h2>
            <p className="text-sm text-muted">This is how your video will appear to students.</p>
            <div className="mt-3 overflow-hidden rounded-lg bg-black">
              {source === "youtube" ? (
                ytValid ? (
                  <iframe key={youtubeId.trim()} src={`https://www.youtube-nocookie.com/embed/${youtubeId.trim()}`}
                    title="YouTube preview" className="aspect-video w-full" allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center p-6 text-center text-sm text-white/70">
                    Enter a valid YouTube video ID to load the preview.
                  </div>
                )
              ) : previewUrl ? (
                <video src={previewUrl} controls className="aspect-video w-full" />
              ) : (
                <div aria-hidden className="relative aspect-video w-full bg-[#e2e8f0]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#475569]/90 text-white">
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-[#475569] px-4 py-2.5 text-sm text-white">
                    <span>▶</span><span>0:00 / 0:00</span>
                    <span className="h-1 flex-1 rounded bg-white/40" />
                    <span>⚙</span><span>⛶</span>
                  </div>
                </div>
              )}
            </div>
            {source === "youtube" && (
              <div className="mt-3 rounded-lg border border-line p-4">
                <p className="font-semibold">{title || "Video title"}</p>
                <p className="mt-0.5 text-sm text-muted">{description || "Video description will appear here."}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b1220] font-bold text-white">
                    {(user?.name?.trim()?.[0] || "T").toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{user?.name || "Your channel"}</p>
                    <p className="text-[13px] text-muted">Teacher</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#dbeafe] bg-[#f0f6ff] p-5 text-sm dark:bg-infosoft" aria-label={source === "youtube" ? "Important Notes" : "Upload Guidelines"}>
            <h3 className="flex items-center gap-2 font-bold text-[#1d4ed8]">
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2f80ed] text-xs text-white">i</span>
              {source === "youtube" ? "Important Notes" : "Upload Guidelines"}
            </h3>
            {source === "youtube" ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                <li>YouTube videos will always be free for students.</li>
                <li>To sell a video, you need to upload your own video file.</li>
                <li>Make sure the YouTube video is appropriate and follows our community guidelines.</li>
              </ul>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                <li>Supported format: MP4 (the server checks the file&apos;s real type).</li>
                <li>Maximum file size: 10 MB (server limit).</li>
                <li>Uploaded files are scanned; students can access them once the scan clears.</li>
                <li>Make sure you have the right to upload this content.</li>
                <li>Inappropriate content is not allowed and may be removed.</li>
              </ul>
            )}
          </section>
        </aside>
      </form>
    </div>
  );
}
