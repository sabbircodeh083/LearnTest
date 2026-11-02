"use client";
import { Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { Engagement, PlaylistRating } from "@/components/purchase";
import { PriceTag } from "@/components/cards";
import { SaveButton } from "@/lib/saved";
import { TestsExamsTable } from "@/components/LinkedTests";
import { apiGet, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { AvatarImg } from "@/components/profile";
import { fmtDate, type Exam, type Page, type Playlist, type Video } from "@/lib/types";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

function PlaylistDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const toast = useToast();
  const fromParam = search.get("from");
  const backHref =
    fromParam === "home" ? "/student?tab=playlists"
    : fromParam === "saved" ? "/student/saved-content"
    : fromParam === "purchases" ? "/student/purchases"
    : "/student/my-learning";
  const backLabel =
    fromParam === "home" ? "Playlist"
    : fromParam === "saved" ? "Saved Content"
    : fromParam === "purchases" ? "Purchased Content"
    : "My Learning";

  const playlist = useFetch(() => apiGet<Playlist>(`/api/v1/playlists/${id}`), [id]);
  const allVideos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ limit: 100 })}`), []);
  const teachers = useFetch(() => apiGet<Page<{ userId: string; name: string; avatarUploadId: string | null }>>(`/api/v1/teachers${qs({ limit: 100 })}`), []);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 100 })}`), []);

  const profileOf = useMemo(() => {
    const m = new Map((teachers.data?.items ?? []).map((t) => [String(t.userId), t]));
    return (ownerId: string) => m.get(String(ownerId));
  }, [teachers.data]);
  const nameOf = (ownerId: string) => profileOf(ownerId)?.name || "Teacher";
  const avatarOf = (ownerId: string) => profileOf(ownerId)?.avatarUploadId ?? null;

  const vids = useMemo(() => {
    const byId = new Map((allVideos.data?.items ?? []).map((v) => [String(v._id), v]));
    return ((playlist.data?.videoIds ?? []).map((vid) => byId.get(String(vid))).filter(Boolean)) as Video[];
  }, [playlist.data, allVideos.data]);

  const current = useMemo(() => {
    const want = search.get("v");
    return (want && vids.find((v) => String(v._id) === want)) || vids[0] || null;
  }, [vids, search]);

  const tests = useMemo(() => {
    const seen = new Set<string>();
    return (exams.data?.items ?? []).filter((e) => {
      if (!e.playlistId || String(e.playlistId) !== String(id) || seen.has(String(e._id))) return false;
      seen.add(String(e._id));
      return true;
    });
  }, [exams.data, id]);

  const videoTests = useMemo(() => {
    if (!current) return [];
    const yt = current.youtubeId;
    const cid = String(current._id);
    const seen = new Set<string>();
    return (exams.data?.items ?? []).filter((e) => {
      if (!e.videoId || (e.videoId !== yt && e.videoId !== cid) || seen.has(String(e._id))) return false;
      seen.add(String(e._id));
      return true;
    });
  }, [exams.data, current]);

  const report = async () => {
    if (!current) return;
    const reason = window.prompt("Why are you reporting this video? (at least 3 characters)");
    if (!reason) return;
    try {
      await apiPost("/api/v1/reports", { targetType: "video", targetId: current._id, reason });
      toast("Report sent for review.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not send report.", "err");
    }
  };

  if (playlist.loading) return <Loading label="Loading playlist…" />;
  if (playlist.error || !playlist.data) {
    return (
      <div>
        <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>
        <div className="mt-4">
          <ErrorBox message={playlist.error ?? "Playlist not found."} onRetry={playlist.retry} />
        </div>
      </div>
    );
  }
  const pl = playlist.data;

  const itemHref = (vid: string) =>
    `/student/playlists/${id}?v=${vid}${fromParam ? `&from=${fromParam}` : ""}`;

  // Playlist-level tests unlock only on the last video of the playlist.
  const isLastVideo = !!current && vids.length > 0 &&
    String(current._id) === String(vids[vids.length - 1]!._id);
  // Prev/next navigation across the playlist videos.
  const currentIdx = current ? vids.findIndex((v) => String(v._id) === String(current._id)) : -1;
  const prevVid = currentIdx > 0 ? vids[currentIdx - 1]! : null;
  const nextVid = currentIdx >= 0 && currentIdx < vids.length - 1 ? vids[currentIdx + 1]! : null;

  return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>

      {!current ? (
        <div className="mt-4">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{pl.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {vids.length} videos · by {nameOf(pl.ownerId)}
          </p>
          <div className="mt-4">
            <Empty title="No videos in this playlist yet" body="The teacher has not added watchable videos here." />
          </div>
        </div>
      ) : (
        <>
          <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{current.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Published {fmtDate(current.createdAt)} · by <Link href={`/student/teachers/${current.ownerId}`} className="inline-flex items-center gap-1.5 font-semibold text-brandstrong hover:underline">
              <AvatarImg uploadId={avatarOf(current.ownerId)} name={nameOf(current.ownerId)} className="h-5 w-5 rounded-full text-[10px]" />
              {nameOf(current.ownerId)}
            </Link>
          </p>

          <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-line bg-black">
                {current.sourceType === "youtube" && current.youtubeId ? (
                  <iframe
                    key={String(current._id)}
                    title={current.title}
                    className="aspect-video w-full"
                    src={`https://www.youtube-nocookie.com/embed/${current.youtubeId}`}
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center p-6 text-center text-sm text-white/80">
                    This is an uploaded video. Playback needs an authorized file download from the teacher — ask them for access if the player is unavailable.
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2.5">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-xs font-bold">
                  {avatarOf(current.ownerId) ? (
                    <AvatarImg uploadId={avatarOf(current.ownerId)} name={nameOf(current.ownerId)} className="h-full w-full" />
                  ) : (
                    initialsOf(nameOf(current.ownerId))
                  )}
                </span>
                <span className="truncate text-sm font-semibold"><Link href={`/student/teachers/${current.ownerId}`} className="hover:text-brandstrong">{nameOf(current.ownerId)}</Link></span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {current.description || "No description provided."}
              </p>
              {!!current.tags.length && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {current.tags.map((t) => (
                    <span key={t} className="text-[13px] text-muted">#{t}</span>
                  ))}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PriceTag price={current.price} currency={current.currency} />
                <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 text-[13px] text-muted">
                  <SaveButton targetType="video" targetId={String(current._id)} />
                  <span>Save video</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 text-[13px] text-muted">
                  <SaveButton targetType="playlist" targetId={String(id)} />
                  <span>Save playlist</span>
                </span>
                <button
                  type="button"
                  onClick={report}
                  className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium hover:bg-soft"
                >
                  Report
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {prevVid ? (
                  <Link href={itemHref(String(prevVid._id))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold hover:bg-soft"
                    aria-label={`Previous video: ${prevVid.title}`}>
                    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
                    Previous
                  </Link>
                ) : <span />}
                <span className="text-xs text-muted">{currentIdx >= 0 ? `${currentIdx + 1} / ${vids.length}` : ""}</span>
                {nextVid ? (
                  <Link href={itemHref(String(nextVid._id))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
                    aria-label={`Next video: ${nextVid.title}`}>
                    Next
                    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                  </Link>
                ) : <span />}
              </div>

              <Engagement targetType="video" targetId={String(current._id)} />
            </div>

            <aside className="rounded-2xl border border-line bg-card p-4" aria-label="Playlist videos">
              <p className="font-bold">{pl.title}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {vids.length} videos · by {nameOf(pl.ownerId)}
              </p>
              <PlaylistRating playlistId={String(id)} />
              <ol className="mt-3 space-y-1.5">
                {vids.map((v, i) => {
                  const active = String(v._id) === String(current._id);
                  return (
                    <li key={String(v._id)}>
                      <Link
                        href={itemHref(String(v._id))}
                        aria-current={active ? "true" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg p-2 transition ${active ? "bg-[#dcfce7] dark:bg-brandsoft" : "hover:bg-soft"}`}
                      >
                        {v.youtubeId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            className="h-11 w-20 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span aria-hidden className="flex h-11 w-20 shrink-0 items-center justify-center rounded-md bg-soft text-xs font-bold text-muted">
                            {i + 1}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold">
                            {i + 1}. {v.title}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </aside>
          </div>

          <TestsExamsTable tests={videoTests} title="Test for video" testHref={(t) => `/student/tests/${t._id}?source=exam&from=playlist&playlistId=${id}${current ? `&v=${current._id}` : ""}`} />
          {isLastVideo && (
            <TestsExamsTable tests={tests} title="Test for playlist" testHref={(t) => `/student/tests/${t._id}?source=exam&from=playlist&playlistId=${id}${current ? `&v=${current._id}` : ""}`} />
          )}
        </>
      )}
    </div>
  );
}

export default function StudentPlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading playlist…" />}>
      <PlaylistDetailInner params={params} />
    </Suspense>
  );
}
