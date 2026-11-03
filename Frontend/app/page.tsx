"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { DiscoverVideos, ModeToggle, PlaylistSlider, PracticeTests, useTeacherProfiles, type DiscoverMode } from "@/components/discover";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Exam, Page, Video } from "@/lib/types";
import { priceLabel } from "@/lib/types";

export default function HomePage() {
  const [mode, setMode] = useState<DiscoverMode>("videos");
  const { nameOf, avatarOf } = useTeacherProfiles();
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ limit: 4 })}`), []);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 20 })}`), []);

  const heroVideo = (videos.data?.items ?? [])[0];
  const heroTests = useMemo(() => {
    if (!heroVideo) return [];
    const yt = heroVideo.youtubeId;
    const id = String(heroVideo._id);
    return (exams.data?.items ?? [])
      .filter((e) => e.videoId && (e.videoId === yt || e.videoId === id))
      .slice(0, 3);
  }, [heroVideo, exams.data]);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main>
        {/* hero */}
        <section className="relative overflow-hidden bg-[#eefbf1] dark:bg-soft">
          <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(40%_60%_at_75%_20%,rgba(34,197,94,0.14)_0%,transparent_70%),radial-gradient(30%_50%_at_55%_80%,rgba(34,197,94,0.10)_0%,transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
            <div>
              <p className="inline-flex rounded-md bg-[#dcfce7] px-2.5 py-1 text-xs font-bold tracking-wide text-[#16a34a]">VIDEO LEARNING • PRACTICE</p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Learn from Videos,<br />Prove Your Knowledge
              </h1>
              <p className="mt-4 max-w-md text-base text-muted">
                Watch, learn, take quizzes, and practise with tests. Turn your learning into confidence.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-5">
              <div className="overflow-hidden rounded-xl border border-line bg-card shadow-[0_8px_30px_rgba(16,24,40,0.10)] sm:col-span-3">
                {videos.loading ? <div className="aspect-video animate-pulse bg-soft" /> : heroVideo ? (
                  <Link href="/sign-in" className="relative block" aria-label={`Watch ${heroVideo.title} (sign in required)`}>
                    {heroVideo.youtubeId
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={`https://i.ytimg.com/vi/${heroVideo.youtubeId}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                      : <div className="flex aspect-video w-full items-center justify-center bg-soft text-sm font-semibold text-muted">{heroVideo.title}</div>}
                    <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-lg">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-soft px-6 text-center text-sm text-muted">Published videos will be featured here.</div>
                )}
              </div>
              <div className="rounded-xl border border-line bg-card p-4 shadow-[0_8px_30px_rgba(16,24,40,0.10)] sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Tests for this video</p>
                  <span className="rounded-md bg-[#dcfce7] px-2 py-0.5 text-xs font-bold text-[#16a34a]">{heroTests.length} test{heroTests.length === 1 ? "" : "s"} found</span>
                </div>
                <div className="mt-3 space-y-2">
                  {!heroTests.length ? (
                    <p className="text-[13px] text-muted">No linked tests yet — teachers attach tests to their videos.</p>
                  ) : heroTests.map((t) => (
                    <Link key={String(t._id)} href="/sign-in"
                      className="flex items-center gap-2.5 rounded-lg border border-line p-2.5 hover:bg-soft">
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f9ec] text-[#16a34a]">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{t.title}</span>
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${(t.price ?? 0) > 0 ? "bg-[#ffedd5] text-[#c2410c]" : "bg-[#dcfce7] text-[#16a34a]"}`}>
                        {priceLabel(t.price, t.currency)}
                      </span>
                      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* lower part: shared discovery */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ModeToggle mode={mode} onChange={setMode} />
          <div className="pb-14">
            {mode === "videos" ? (
              <DiscoverVideos videoHref={() => "/sign-in"} teacherHref={() => "/sign-in"} nameOf={nameOf} avatarOf={avatarOf} />
            ) : mode === "tests" ? (
              <PracticeTests testHref={() => "/sign-in"} teacherHref={() => "/sign-in"} nameOf={nameOf} avatarOf={avatarOf} actionLabel="View Details" />
            ) : (
              <PlaylistSlider title="Playlists" teacherHref={() => "/sign-in"} />
            )}
          </div>
        </div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>LearnTest — learn from videos, prove your knowledge.</p>
          <div className="flex gap-4">
            <Link href="/sign-in" className="hover:text-brandstrong">Sign in</Link>
            <Link href="/sign-up" className="hover:text-brandstrong">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
