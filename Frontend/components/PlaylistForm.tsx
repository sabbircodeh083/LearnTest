"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldError, Notice, errCls, useToast } from "@/components/ui";
import { apiGet, apiPatch, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Page, Playlist, Video } from "@/lib/types";
import { checkTags } from "@/lib/validation";

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

function TagsInput({ value, onChange, onError, error }: { value: string[]; onChange: (t: string[]) => void; onError?: (m: string) => void; error?: string }) {
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
            if (t && value.includes(t)) onError?.(`Tag "${t}" is already added.`);
            else if (t && value.length >= 20) onError?.("You can add at most 20 tags — remove one first.");
            else if (t && t.length > 40) onError?.("Each tag must be 40 characters or less.");
            else if (t) { onChange([...value, t]); onError?.(""); }
            setDraft("");
          }
        }}
        placeholder="Add tags and press Enter..."
        aria-label="Add tags and press Enter" className="min-w-[180px] flex-1 bg-transparent outline-none placeholder:text-muted/70" />
      <FieldError>{error}</FieldError>
    </div>
  );
}

/**
 * Shared create/edit playlist form — the edit page (`playlists/[id]`) renders
 * the exact create-page UI, prefilled, and saves with PATCH instead of POST.
 */
export function PlaylistForm({ initial }: { initial?: Playlist }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial?._id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [videoIds, setVideoIds] = useState<string[]>((initial?.videoIds ?? []).map(String));
  const [pickId, setPickId] = useState("");
  const [visibility, setVisibility] = useState<string>(initial?.visibility ?? "public");
  const [status, setStatus] = useState(initial?.status === "published" ? "published" : "draft");

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearErr = (k: string) => setFieldErrors((p) => (p[k] ? { ...p, [k]: "" } : p));
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, limit: 100 })}`), []);
  const ownVideos = videos.data?.items ?? [];
  const byId = new Map(ownVideos.map((v) => [String(v._id), v]));
  const picked = videoIds.map((id) => byId.get(id)).filter(Boolean) as Video[];
  const addable = ownVideos.filter((v) => !videoIds.includes(String(v._id)));

  const move = (id: string, dir: -1 | 1) =>
    setVideoIds((ids) => {
      const i = ids.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return ids;
      const next = [...ids];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = async (nextStatus: "draft" | "published") => {
    setError("");
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    else if (title.trim().length > 200) errs.title = "Title must be 200 characters or less.";
    if (description.length > 1000) errs.description = "Description must be 1,000 characters or less.";
    const tagErr = checkTags(tags); if (tagErr) errs.tags = tagErr;
    if (!videoIds.length) errs.videoIds = "Add at least one video to the playlist — pick one from the list below.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) { setError("Please fix the highlighted fields below."); return; }

    setBusy(nextStatus === "draft" ? "draft" : "publish");
    try {
      const body = {
        title: title.trim(), description, tags,
        visibility, status: nextStatus,
        price: 0, // playlists are always free for students (currency irrelevant; server default applies)
        videoIds,
      };
      if (editing) {
        await apiPatch(`/api/v1/playlists/${initial!._id}`, body);
        toast("Playlist updated.");
      } else {
        await apiPost("/api/v1/playlists", body);
        toast(nextStatus === "published" ? "Playlist published." : "Playlist saved as draft.");
      }
      router.push("/teacher/playlists");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save the playlist.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href="/teacher/playlists" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Playlists</Link>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e0f2fe] text-[#0284c7]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{editing ? "Edit Playlist" : "Create Playlist"}</h1>
          <p className="text-[15px] text-muted">
            {editing
              ? "Update your playlist details and videos. Playlists are always free for students."
              : "Group your videos into a playlist students can watch in order."}
          </p>
        </div>
      </div>

      {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Basic information */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Basic Information">
            <h2 className="text-[17px] font-bold">Basic Information</h2>
            <div className="mt-3">
              <Label required>Title</Label>
              <input value={title} onChange={(e) => { setTitle(e.target.value); clearErr("title"); }} maxLength={200} placeholder="Web Development Bootcamp" aria-invalid={!!fieldErrors.title} className={`${inputCls}${errCls(fieldErrors.title)}`} />
              <FieldError>{fieldErrors.title}</FieldError>
              <p className="mt-1 text-right text-xs text-muted">{title.length}/200</p>
            </div>
            <div className="mt-2">
              <Label>Description</Label>
              <textarea value={description} onChange={(e) => { setDescription(e.target.value); clearErr("description"); }} rows={3} maxLength={1000}
                placeholder="What will students learn in this playlist?" aria-invalid={!!fieldErrors.description} className={`${inputCls}${errCls(fieldErrors.description)}`} />
              <FieldError>{fieldErrors.description}</FieldError>
              <p className="mt-1 text-right text-xs text-muted">{description.length}/1000</p>
            </div>
            <div className="mt-2">
              <Label optional>Tags</Label>
              <TagsInput value={tags} onChange={(tg) => { setTags(tg); clearErr("tags"); }} onError={(m) => setFieldErrors((p) => ({ ...p, tags: m }))} error={fieldErrors.tags} />
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-[#f0f6ff] p-4 text-sm dark:bg-infosoft">
              <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f80ed] text-xs font-bold text-white">i</span>
              <p className="text-muted"><span className="font-medium text-ink">Playlists are always free for students.</span><br />To sell content, set a price on your individual videos instead.</p>
            </div>
          </section>

          {/* Videos */}
          <section className="rounded-xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Playlist Videos">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold">Videos</h2>
              <p className="text-sm text-muted">Total Videos: {videoIds.length}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={inputCls} aria-label="Choose one of your videos to add">
                <option value="">Choose one of your videos…</option>
                {addable.map((v) => <option key={String(v._id)} value={String(v._id)}>{v.title}</option>)}
              </select>
              <button type="button" disabled={!pickId}
                onClick={() => { if (pickId) { setVideoIds((ids) => [...ids, pickId]); setPickId(""); clearErr("videoIds"); } }}
                className="shrink-0 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
                Add
              </button>
            </div>
            <FieldError>{fieldErrors.videoIds}</FieldError>
            {videos.loading ? <p className="mt-3 text-sm text-muted">Loading your videos…</p>
              : videos.error ? <p className="mt-3 text-sm text-danger">Could not load your videos.</p>
              : !ownVideos.length ? <p className="mt-3 text-sm text-muted">You have no videos yet — upload one from the Videos page first.</p>
              : null}
            <div className="mt-4 space-y-3">
              {videoIds.map((id, i) => {
                const v = byId.get(id);
                return (
                  <article key={id} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
                    <span className="flex flex-col items-center text-muted">
                      <button type="button" aria-label={`Move video ${i + 1} up`} onClick={() => move(id, -1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▲</button>
                      <span aria-hidden className="text-xs">⋮⋮</span>
                      <button type="button" aria-label={`Move video ${i + 1} down`} onClick={() => move(id, 1)} className="rounded p-0.5 text-[10px] hover:bg-soft hover:text-ink">▼</button>
                    </span>
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">{v?.title ?? "Video"}</p>
                      <p className="truncate text-[13px] text-muted">{id}</p>
                    </div>
                    <button type="button" title="Remove video" aria-label={`Remove ${v?.title ?? id}`}
                      onClick={() => setVideoIds((ids) => ids.filter((x) => x !== id))}
                      className="rounded-lg border border-line p-2 text-[#dc2626] hover:bg-[#fee2e2]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>
                    </button>
                  </article>
                );
              })}
              {!videoIds.length && <p className="text-sm text-muted">No videos added yet — pick one above to start your playlist.</p>}
            </div>
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Playlist Settings">
            <h2 className="text-[17px] font-bold">Playlist Settings</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label required>Visibility</Label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputCls}>
                  <option value="public">🌐 Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
                <p className="mt-1 text-xs text-muted">Who can watch this playlist.</p>
              </div>
              <div>
                <Label required>Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="published">▷ Published</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Student View Preview">
            <h2 className="text-[17px] font-bold">Student View Preview</h2>
            <div className="mt-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{title.trim() || "Untitled playlist"}</p>
                <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">Free</span>
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                <span>🎬 {videoIds.length} Video{videoIds.length === 1 ? "" : "s"}</span>
              </p>
              <p className="mt-3 text-sm font-bold">Videos in order</p>
              <div className="mt-2 space-y-2">
                {picked.map((v, i) => (
                  <div key={String(v._id)} className="flex items-center gap-2.5 rounded-lg border border-line p-2.5">
                    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{i + 1}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">{v.title}</p>
                  </div>
                ))}
                {!picked.length && <p className="text-sm text-muted">Add a video to see it here.</p>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5 card-hover" aria-label="Playlist Summary">
            <h2 className="text-[17px] font-bold">Playlist Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Videos", String(videoIds.length)],
                ["Price", "Free"],
                ["Visibility", visibility],
                ["Status", status],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-dotted border-line pb-1.5 last:border-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium capitalize">{v}</dd>
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
              {busy === "publish" ? (editing ? "Updating…" : "Publishing…") : (editing ? "Update Playlist" : "Publish Playlist")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
