"use client";
import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { Btn, Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { PlaylistCard, VideoCard } from "@/components/cards";
import { RateDialog } from "@/components/RateDialog";
import { AvatarImg, CoverBanner, SOCIAL_TILES, SocialTile, handleOf, joinedLabel } from "@/components/profile";
import { apiDelete, apiGet, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Exam, Page, Playlist, TeacherProfile, Video } from "@/lib/types";

const cardCls = "rounded-2xl border border-line bg-card p-5 sm:p-6";

function TeacherProfileInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { confirm, promptReason } = useDialog();
  const teacher = useFetch(() => apiGet<TeacherProfile>(`/api/v1/teachers/${id}`), [id]);
  const follows = useFetch(() => apiGet<Page<{ teacherId: string }>>("/api/v1/follows/me?limit=100"), []);
  const blocks = useFetch(() => apiGet<Page<{ teacherId: string }>>("/api/v1/blocks/me?limit=100"), []);
  const ratingSummary = useFetch(
    () => apiGet<{ items: { targetId: string; avg: number; count: number }[] }>(`/api/v1/ratings/summary${qs({ targetType: "teacher", targetIds: id })}`),
    [id],
  );
  const allVideos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ limit: 100 })}`), []);
  const allExams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 100 })}`), []);
  const allPlaylists = useFetch(() => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ limit: 100 })}`), []);

  const [busy, setBusy] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);

  const following = (follows.data?.items ?? []).some((f) => String(f.teacherId) === id);
  const blocked = (blocks.data?.items ?? []).some((b) => String(b.teacherId) === id);
  const rating = ratingSummary.data?.items?.[0];

  const videos = useMemo(
    () => (allVideos.data?.items ?? []).filter((v) => String(v.ownerId) === id),
    [allVideos.data, id],
  );
  const tests = useMemo(
    () => [
      ...(allExams.data?.items ?? [])
        .filter((e) => String(e.ownerId) === id)
        .map((e) => ({ id: String(e._id), source: "exam" as const, title: e.title, kind: e.kind ?? "quiz" })),
    ],
    [allExams.data, id],
  );
  const playlists = useMemo(
    () => (allPlaylists.data?.items ?? []).filter((p) => String(p.ownerId) === id),
    [allPlaylists.data, id],
  );
  const videoById = useMemo(
    () => new Map((allVideos.data?.items ?? []).map((v) => [String(v._id), v])),
    [allVideos.data],
  );
  const thumbOf = (p: Playlist) => {
    for (const vid of p.videoIds ?? []) {
      const yt = videoById.get(String(vid))?.youtubeId;
      if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    }
    return null;
  };

  if (teacher.loading) return <Loading label="Loading teacher profile…" />;
  if (teacher.error || !teacher.data) {
    return (
      <div>
        <Link href="/student" className="text-sm font-semibold text-brandstrong">← Home</Link>
        <div className="mt-4">
          <ErrorBox message={teacher.error ?? "Teacher not found."} onRetry={teacher.retry} />
        </div>
      </div>
    );
  }
  const t = teacher.data;
  const name = t.name?.trim() || "Unnamed teacher";
  const socials = t.socials ?? { github: "", youtube: "", linkedin: "", dev: "", website: "" };
  const linkedSocials = SOCIAL_TILES.filter((s) => (socials[s.key] ?? "").trim() !== "");

  const toggleFollow = async () => {
    setBusy("follow");
    try {
      if (following) { await apiDelete(`/api/v1/follows/${id}`); toast("Unfollowed."); }
      else { await apiPost("/api/v1/follows", { teacherId: id }); toast("Teacher followed."); }
      follows.retry();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not update follow.", "err");
    } finally { setBusy(null); }
  };

  const toggleBlock = async () => {
    setBusy("block");
    try {
      if (blocked) {
        await apiDelete(`/api/v1/blocks/${id}`);
        toast("Teacher unblocked. Their content will appear again.");
      } else {
        if (!(await confirm({ title: `Block ${name}?`, message: "Their videos, tests, and playlists will be hidden from you.", confirmLabel: "Block", danger: true }))) return;
        await apiPost("/api/v1/blocks", { teacherId: id });
        toast("Teacher blocked. Their content is now hidden.");
      }
      blocks.retry();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not update block.", "err");
    } finally { setBusy(null); }
  };

  const report = async () => {
    const reason = await promptReason({ title: `Report ${name}`, label: "Why are you reporting this teacher?", placeholder: "Describe the problem (at least 3 characters)…", confirmLabel: "Send report", danger: true });
    if (!reason) return;
    try {
      await apiPost("/api/v1/reports", { targetType: "teacher", targetId: id, reason });
      toast("Report sent for review.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not send report.", "err");
    }
  };

  const submitRating = async () => {
    if (!myRating) { setRateOpen(false); return; }
    setRateBusy(true);
    try {
      await apiPost("/api/v1/ratings", { targetType: "teacher", targetId: id, value: myRating });
      toast(`Thanks — you rated ${name} ${myRating}/5.`);
      setRateOpen(false);
      ratingSummary.retry();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save rating.", "err");
    } finally { setRateBusy(false); }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href="/student" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Home</Link>

      {/* cover */}
      <div className="relative mt-3 h-44 overflow-hidden rounded-t-2xl sm:h-56">
        <CoverBanner uploadId={t.coverUploadId} className="h-full w-full" />
      </div>

      {/* identity + actions */}
      <section className={`${cardCls} rounded-t-none`} aria-label="Teacher summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative -mt-16 h-28 w-28 shrink-0 sm:-mt-20 sm:h-32 sm:w-32">
            <span className="block h-full w-full overflow-hidden rounded-full text-3xl ring-4 ring-card">
              <AvatarImg uploadId={t.avatarUploadId} name={name} className="h-full w-full" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted">{handleOf(t)}</p>
            <p className="mt-0.5 text-sm font-medium">
              Teacher{t.subject ? ` • ${t.subject}` : ""}
              {rating ? <span className="text-muted"> · <span aria-hidden className="text-[#f5a623]">★</span> {rating.avg.toFixed(1)} ({rating.count} rating{rating.count === 1 ? "" : "s"})</span> : null}
            </p>
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted">{t.bio?.trim() || "Teacher on LearnTest"}</p>
            {blocked && (
              <p role="note" className="mt-2 inline-block rounded-lg bg-warnsoft px-3 py-1.5 text-[13px] font-medium text-warn">
                You blocked this teacher — their content is hidden from you.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            <Btn onClick={toggleFollow} disabled={busy !== null}>{busy === "follow" ? "…" : following ? "Following" : "Follow"}</Btn>
            <Btn variant="soft" onClick={() => setRateOpen(true)}>★ Rate</Btn>
            <Btn variant="ghost" onClick={report}>Report</Btn>
            <Btn variant="ghost" onClick={toggleBlock} disabled={busy !== null}>{busy === "block" ? "…" : blocked ? "Unblock" : "Block"}</Btn>
          </div>
        </div>
      </section>

      {/* about */}
      <section className={`${cardCls} mt-4`} aria-label="About this teacher">
        <h2 className="text-[17px] font-bold">About</h2>
        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted">{t.bio?.trim() || "No bio yet."}</p>
        <div className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
          {t.username?.trim() && <p>@{t.username}</p>}
          {t.university?.trim() && <p>{t.university}{t.degree?.trim() ? ` · ${t.degree}` : ""}</p>}
          {t.location?.trim() && <p>{t.location}</p>}
          <p className="text-muted">{joinedLabel(t.createdAt)}</p>
        </div>
        {!!(t.skills ?? []).length && (
          <p className="mt-4 flex flex-wrap gap-2">
            {(t.skills ?? []).map((s) => (
              <span key={s} className="rounded-full bg-[#e8f1fe] px-3.5 py-1.5 text-[13px] font-medium text-[#1d4ed8] dark:bg-soft">{s}</span>
            ))}
          </p>
        )}
        {!!linkedSocials.length && (
          <div className="mt-4 flex flex-wrap gap-2.5 border-t border-line pt-4">
            {linkedSocials.map((s) => (
              <SocialTile key={s.key} tile={s} href={(socials[s.key] ?? "").trim()} />
            ))}
          </div>
        )}
      </section>

      {/* content */}
      <section className="mt-6" aria-label="Teacher videos">
        <h2 className="font-display text-xl font-bold sm:text-2xl">Videos ({videos.length})</h2>
        <div className="mt-3">
          {!videos.length ? <Empty title="No videos yet" body="This teacher has not published videos yet." /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => <VideoCard key={String(v._id)} video={v} href={`/student/videos/${String(v._id)}`} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8" aria-label="Teacher tests">
        <h2 className="font-display text-xl font-bold sm:text-2xl">Tests ({tests.length})</h2>
        <div className="mt-3">
          {!tests.length ? <Empty title="No tests yet" body="This teacher has not published tests yet." /> : (
            <ol className="divide-y divide-line rounded-xl border border-line bg-card">
              {tests.map((x) => (
                <li key={`${x.source}-${x.id}`} className="flex items-center justify-between gap-3 p-4">
                  <p className="min-w-0 truncate font-semibold">{x.title}</p>
                  <Link href={`/student/tests/${x.id}?source=${x.source}`} className="shrink-0 rounded-lg bg-[#16a34a] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#15803d]">Attempt Test</Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="mt-8" aria-label="Teacher playlists">
        <h2 className="font-display text-xl font-bold sm:text-2xl">Playlists ({playlists.length})</h2>
        <div className="mt-3">
          {!playlists.length ? <Empty title="No playlists yet" body="This teacher has not published playlists yet." /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((p) => (
                <PlaylistCard key={String(p._id)} playlist={p} thumbnailUrl={thumbOf(p)} href={`/student/playlists/${String(p._id)}`} creator={{ name, avatarUploadId: t.avatarUploadId ?? null }} />
              ))}
            </div>
          )}
        </div>
      </section>

      <RateDialog
        open={rateOpen}
        title={`Rate ${name}`}
        sub="How is this teacher overall? Your rating helps other students."
        value={myRating}
        busy={rateBusy}
        onPick={setMyRating}
        onClose={() => setRateOpen(false)}
        onSubmit={submitRating}
      />
    </div>
  );
}

export default function StudentTeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading teacher profile…" />}>
      <TeacherProfileInner params={params} />
    </Suspense>
  );
}
