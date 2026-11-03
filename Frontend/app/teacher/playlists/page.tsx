"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, Btn, Empty, ErrorBox, Loading, statusTone, useToast } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { PriceTag } from "@/components/cards";
import { apiDelete, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Page, Playlist, Video } from "@/lib/types";

export default function TeacherPlaylistsPage() {
  const toast = useToast();
  const { confirm } = useDialog();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const list = useFetch(
    () => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ mine: 1, search: submitted, limit: 30 })}`),
    [submitted],
  );
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, limit: 100 })}`), []);
  const byId = new Map((videos.data?.items ?? []).map((v) => [String(v._id), v]));
  const thumbOf = (p: Playlist) => {
    for (const id of p.videoIds ?? []) {
      const yt = byId.get(String(id))?.youtubeId;
      if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    }
    return null;
  };

  const act = async (p: Playlist, action: "publish" | "draft" | "hide" | "delete") => {
    setMenuId(null);
    try {
      if (action === "hide") {
        if (!(await confirm({ title: "Hide this playlist?", message: "It will no longer be published.", confirmLabel: "Hide", danger: true }))) return;
        await apiDelete(`/api/v1/playlists/${p._id}`);
        toast("Playlist hidden.");
      } else if (action === "delete") {
        if (!(await confirm({ title: `Permanently delete "${p.title}"?`, message: "This cannot be undone.", confirmLabel: "Delete permanently", danger: true }))) return;
        await apiDelete(`/api/v1/playlists/${p._id}?hard=true`);
        toast("Playlist permanently deleted.");
      } else {
        await apiPatch(`/api/v1/playlists/${p._id}`, { status: action === "publish" ? "published" : "draft" });
        toast(action === "publish" ? "Published." : "Moved to draft.");
      }
      list.retry();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action failed.", "err");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Playlists</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Group your videos into playlists using video IDs from the Videos page.</p>
        </div>
        <Btn href="/teacher/playlists/new">New playlist</Btn>
      </div>
      <form role="search" className="mb-5 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(search.trim()); }}>
        <label className="sr-only" htmlFor="playlist-search">Search your playlists</label>
        <input id="playlist-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your playlists…"
          className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm" />
        <Btn type="submit">Search</Btn>
      </form>

      {list.loading ? <Loading label="Loading your playlists…" /> : list.error ? <ErrorBox message={list.error} onRetry={list.retry} /> :
        !list.data?.items.length ? <Empty title="No playlists yet" body="Create your first playlist and publish it when ready." action={<Btn href="/teacher/playlists/new">Create playlist</Btn>} /> : (
          <ul className="space-y-3">
            {list.data.items.map((p) => {
              const pid = String(p._id);
              const thumb = thumbOf(p);
              return (
                <li key={pid} className="rounded-xl border border-line bg-card p-4 card-hover">
                  <div className="flex items-center gap-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" loading="lazy" className="h-16 w-28 shrink-0 rounded-lg border border-line object-cover" />
                    ) : (
                      <div aria-hidden className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-soft text-xs font-semibold text-muted">No thumbnail</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.title}</p>
                      <p className="truncate text-xs text-muted">ID: {pid}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <span className="text-sm text-muted">{p.videoIds?.length ?? 0} videos</span>
                      <PriceTag price={p.price} currency={p.currency} />
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    </div>
                    <div className="relative shrink-0">
                      <button type="button" onClick={() => setMenuId(menuId === pid ? null : pid)}
                        aria-label={`Actions for ${p.title}`} aria-expanded={menuId === pid} aria-haspopup="menu"
                        className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                          <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                        </svg>
                      </button>
                      {menuId === pid && (
                        <>
                          <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} />
                          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-card py-1 text-sm shadow-lg">
                            <Link role="menuitem" href={`/teacher/playlists/${pid}`} className="block px-4 py-2 hover:bg-soft">Edit</Link>
                            {p.status !== "published"
                              ? <button role="menuitem" type="button" onClick={() => act(p, "publish")} className="block w-full px-4 py-2 text-left hover:bg-soft">Publish</button>
                              : <button role="menuitem" type="button" onClick={() => act(p, "draft")} className="block w-full px-4 py-2 text-left hover:bg-soft">Draft</button>}
                            <button role="menuitem" type="button" onClick={() => act(p, "hide")} className="block w-full px-4 py-2 text-left text-muted hover:bg-soft">Hide</button>
                            <button role="menuitem" type="button" onClick={() => act(p, "delete")} className="block w-full px-4 py-2 text-left text-danger hover:bg-soft">Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
