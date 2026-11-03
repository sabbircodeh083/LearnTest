"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { useToast } from "@/components/ui";
import { DataList, DataRow, RowChip } from "@/components/DataList";
import { apiDelete, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { idOf, type Page, type Playlist, type Video } from "@/lib/types";

type Tab = "all" | "published" | "draft";
type SortKey = "newest" | "oldest";
const PAGE_SIZE = 8;

function Thumb({ video }: { video: Video }) {
  if (video.sourceType === "youtube" && video.youtubeId) {
    return (
      <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[#0b1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-[#0b1220] text-white">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
    </span>
  );
}

function RowMenu({ video, onDone }: { video: Video; onDone: () => void }) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const busy = false;
  const act = async (action: "publish" | "draft" | "soft" | "hard" | "copy") => {
    setOpen(false);
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(idOf(video));
        toast("Video ID copied.");
        return;
      }
      if (action === "soft") {
        if (!(await confirm({ title: `Delete "${video.title}"?`, message: "It will be hidden from students. You can re-publish it later.", confirmLabel: "Delete", danger: true }))) return;
        await apiDelete(`/api/v1/videos/${idOf(video)}`);
        toast("Video deleted.");
      } else if (action === "hard") {
        if (!(await confirm({ title: `Permanently delete "${video.title}"?`, message: "This removes the video, its uploaded file, and its playlist entries. This cannot be undone.", confirmLabel: "Delete permanently", danger: true }))) return;
        await apiDelete(`/api/v1/videos/${idOf(video)}?hard=true`);
        toast("Video permanently deleted.");
      } else {
        await apiPatch(`/api/v1/videos/${idOf(video)}`, { status: action === "publish" ? "published" : "draft" });
        toast(action === "publish" ? "Video published." : "Video moved to draft.");
      }
      onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action failed.", "err");
    }
  };
  return (
    <div className="relative">
      <button aria-label={`Actions for ${video.title}`} aria-expanded={open}
        onClick={(e) => {
          if (open) { setOpen(false); return; }
          // Fixed positioning escapes the table's scroll container, and the
          // menu flips upward when there is no room below (last rows).
          const r = e.currentTarget.getBoundingClientRect();
          const up = window.innerHeight - r.bottom < 230;
          setPos(up
            ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
            : { top: r.bottom + 4, right: window.innerWidth - r.right });
          setOpen(true);
        }}
        className="rounded-lg p-2 text-muted hover:bg-soft">⋮</button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div style={pos ?? undefined} className="fixed right-0 z-20 w-44 rounded-xl border border-line bg-card py-1 text-sm shadow-lg">
            <Link href={`/teacher/videos/${idOf(video)}`} onClick={() => setOpen(false)} className="block w-full px-4 py-2 text-left hover:bg-soft">Edit</Link>
            {video.status !== "published"
              ? <button disabled={busy} onClick={() => act("publish")} className="block w-full px-4 py-2 text-left hover:bg-soft">Publish</button>
              : <button disabled={busy} onClick={() => act("draft")} className="block w-full px-4 py-2 text-left hover:bg-soft">Move to draft</button>}
            <button onClick={() => act("copy")} className="block w-full px-4 py-2 text-left hover:bg-soft">Copy video ID</button>
            <button onClick={() => act("soft")} className="block w-full px-4 py-2 text-left text-danger hover:bg-soft">Delete</button>
            <button onClick={() => act("hard")} className="block w-full px-4 py-2 text-left text-danger hover:bg-soft">Delete permanently</button>
          </div>
        </>
      )}
    </div>
  );
}

function BackToProfile() {
  const sp = useSearchParams();
  if (sp.get("from") !== "profile") return null;
  return (
    <Link href="/teacher/profile" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Profile</Link>
  );
}

export default function TeacherVideosPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const key = [debounced].join("|");
  const videos = useFetch(
    () => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, search: debounced || undefined, limit: 100 })}`),
    [key],
  );
  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, limit: 100 })}`), []);

  const playlistOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of playlists.data?.items ?? []) {
      for (const vid of p.videoIds ?? []) if (!map.has(String(vid))) map.set(String(vid), p.title);
    }
    return map;
  }, [playlists.data]);

  const items = videos.data?.items ?? [];
  const counts = useMemo(() => ({
    all: videos.data?.total ?? 0,
    published: items.filter((v) => v.status === "published").length,
    draft: items.filter((v) => v.status === "draft").length,
  }), [items, videos.data]);
  const truncated = (videos.data?.total ?? 0) > items.length;

  const rows = useMemo(() => {
    const f = items.filter((v) => tab === "all" || (tab === "published" ? v.status === "published" : v.status === "draft"));
    f.sort((a, b) => sort === "newest"
      ? +new Date(b.createdAt) - +new Date(a.createdAt)
      : +new Date(a.createdAt) - +new Date(b.createdAt));
    return f;
  }, [items, tab, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="-m-4 min-h-[calc(100dvh-7rem)] bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Suspense>
        <BackToProfile />
      </Suspense>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">Videos</h1>
          <p className="mt-1 text-[15px] text-muted">Manage your video content. Keep videos between 15-25 minutes.</p>
        </div>
        <Link href="/teacher/videos/new" className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#15803d]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Upload Video
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos..." aria-label="Search videos"
            className="w-full rounded-xl border border-line bg-card py-3.5 pl-12 pr-4 text-[15px] placeholder:text-muted/70 focus:border-brand" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort videos"
          className="rounded-xl border border-line bg-card px-5 py-3.5 text-[15px] font-medium">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <div className="mt-4 flex gap-6 overflow-x-auto rounded-xl border border-line bg-card px-5 pt-3" role="tablist" aria-label="Filter videos by status">
        {([["all", `All Videos (${counts.all})`], ["published", `Published (${counts.published})`], ["draft", `Drafts (${counts.draft})`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPage(1); }}
            className={`whitespace-nowrap pb-3 text-[16px] ${tab === t ? "font-semibold text-[#16a34a] shadow-[inset_0_-2px_0_#16a34a]" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        {videos.loading ? <div className="p-6"><Loading label="Loading videos…" /></div>
          : videos.error ? <div className="p-6"><ErrorBox message={videos.error} onRetry={videos.retry} /></div>
          : !rows.length ? <div className="p-6"><Empty title={tab === "all" ? "No videos yet" : `No ${tab} videos`} body={debounced ? "Nothing matches this search." : "Upload your first video to start teaching."} action={<Link href="/teacher/videos/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Upload Video</Link>} /></div>
          : (
            <DataList label="Videos">
              {pageRows.map((v, i) => (
                <DataRow
                  key={idOf(v)}
                  icon={<Thumb video={v} />}
                  title={`${(page - 1) * PAGE_SIZE + i + 1}. ${v.title}`}
                  meta={playlistOf.get(idOf(v)) ?? "No playlist"}
                  chip={
                    <RowChip tone={v.status === "published" ? "bg-[#e6f9ec] text-[#16a34a]" : v.status === "draft" ? "bg-[#eef1f6] text-muted dark:bg-soft" : "bg-[#fef3e2] text-[#b45309]"}>
                      {v.status === "published" ? "Published" : v.status === "draft" ? "Draft" : v.status}
                    </RowChip>
                  }
                  actions={<RowMenu video={v} onDone={videos.retry} />}
                />
              ))}
            </DataList>
          )}
      </div>

      {!videos.loading && !videos.error && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <p>Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-line bg-card px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded-lg border border-line bg-card px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
      {truncated && <p className="mt-3 text-xs text-muted">Showing the 100 most recent matches; counts for Published/Drafts cover those 100.</p>}
    </div>
  );
}
