"use client";
import { useState } from "react";
import { PlaylistCard, VideoCard } from "@/components/cards";
import { Btn, Empty, ErrorBox, inputCls, Loading, PageHead } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { useTeacherProfiles } from "@/components/discover";
import type { Page, Playlist, Video } from "@/lib/types";

export default function MyLearningPage() {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { nameOf, avatarOf } = useTeacherProfiles();
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ search: submitted, limit: 12 })}`), [submitted]);
  const playlists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ limit: 6 })}`), []);

  return (
    <div>
      <PageHead title="My Learning" sub="Published videos and playlists. There is no separate progress tracker yet, so this shows the real published catalogue — nothing is marked “in progress” without server data." />
      <form role="search" className="mb-6 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(search.trim()); }}>
        <label className="sr-only" htmlFor="learn-search">Search videos</label>
        <input id="learn-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos…" className={inputCls} />
        <Btn type="submit">Search</Btn>
      </form>
      <h2 className="mb-4 font-display text-xl font-bold">Videos</h2>
      {videos.loading ? <Loading label="Loading videos…" /> : videos.error ? <ErrorBox message={videos.error} onRetry={videos.retry} /> :
        !videos.data?.items.length ? <Empty title="No videos found" body="No published videos match this view yet." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{videos.data.items.map((v) => <VideoCard key={v._id} video={v} href={`/student/videos/${String(v._id)}?from=learning`} />)}</div>
        )}
      <h2 className="mb-4 mt-10 font-display text-xl font-bold">Playlists</h2>
      {playlists.loading ? <Loading label="Loading playlists…" /> : playlists.error ? <ErrorBox message={playlists.error} onRetry={playlists.retry} /> :
        !playlists.data?.items.length ? <Empty title="No playlists yet" body="Teachers have not published playlists yet." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{playlists.data.items.map((p) => <PlaylistCard key={p._id} playlist={p} href={`/student/playlists/${p._id}`} creator={{ name: nameOf(p.ownerId), avatarUploadId: avatarOf(p.ownerId), href: `/student/teachers/${p.ownerId}` }} />)}</div>
        )}
    </div>
  );
}
