"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Empty, ErrorBox, Loading } from "./ui";
import { PlaylistCard } from "./cards";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { AvatarImg } from "./profile";
import { SaveButton, saveKey, useSaved } from "@/lib/saved";
import { purchaseKey, usePurchasedIds } from "@/lib/purchases";
import { useBlockedIds } from "@/lib/blocks";
import { fmtDate, type Assignment, type Exam, type Page, type Playlist, type Video } from "@/lib/types";

export type DiscoverMode = "videos" | "tests" | "playlists";

/** Videos loaded per infinite-scroll page. */
const PAGE_SIZE = 16;

interface Teacher { userId: string; name: string; email: string; avatarUploadId: string | null }

const KIND_META: Record<string, { label: string; badge: string; box: string; icon: React.ReactNode }> = {
  quiz: {
    label: "Quiz", badge: "bg-[#e6f9ec] text-[#16a34a]", box: "bg-[#e6f9ec] text-[#16a34a]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /></svg>),
  },
  written: {
    label: "Written Exam", badge: "bg-[#e8f1fe] text-[#1d6ce0]", box: "bg-[#e8f1fe] text-[#1d6ce0]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg>),
  },
  problem: {
    label: "Problem Solving", badge: "bg-[#ede9fe] text-[#7c3aed]", box: "bg-[#ede9fe] text-[#7c3aed]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" /></svg>),
  },
  project: {
    label: "Project", badge: "bg-[#ffedd5] text-[#c2410c]", box: "bg-[#ffedd5] text-[#ea580c]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>),
  },
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

export interface TestRow {
  id: string;
  source: "exam" | "assignment";
  kind: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  durationMinutes: number | null;
  deadline: string | null;
  ownerId: string;
  createdAt: string;
}

export function useTeacherProfiles() {
  const teachers = useFetch(() => apiGet<Page<Teacher>>(`/api/v1/teachers${qs({ limit: 100 })}`), []);
  const map = useMemo(() => {
    const m = new Map((teachers.data?.items ?? []).map((t) => [String(t.userId), t]));
    return {
      nameOf: (ownerId: string) => m.get(String(ownerId))?.name || "Teacher",
      avatarOf: (ownerId: string) => m.get(String(ownerId))?.avatarUploadId ?? null,
    };
  }, [teachers.data]);
  return map;
}

export function ModeToggle({ mode, onChange, videosTitle = "Learn with Videos", testsTitle = "Practice with Tests", playlistsTitle = "Playlist" }: {
  mode: DiscoverMode; onChange: (m: DiscoverMode) => void;
  videosTitle?: string; testsTitle?: string; playlistsTitle?: string;
}) {
  return (
    <div className="grid gap-4 py-6 sm:grid-cols-3" role="tablist" aria-label="Discovery mode">
      {([
        { key: "videos", title: videosTitle },
        { key: "tests", title: testsTitle },
        { key: "playlists", title: playlistsTitle },
      ] as const).map((m) => (
        <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => onChange(m.key)}
          className={`flex items-center gap-3 rounded-xl p-4 text-left transition ${mode === m.key ? "bg-[#dcfce7] dark:bg-brandsoft" : "hover:bg-soft"}`}>
          <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${mode === m.key ? "bg-[#bbf7d0] text-[#16a34a]" : "bg-soft text-muted"}`}>
            {m.key === "videos"
              ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5l5-2.8v8.6l-5-2.8" /></svg>
              : m.key === "tests"
                ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /></svg>
                : <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>}
          </span>
          <span>
            <span className={`block font-bold ${mode === m.key ? "text-[#16a34a]" : ""}`}>{m.title}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function DiscoverVideos({ videoHref, nameOf, avatarOf = () => null, teacherHref = (ownerId: string) => `/student/teachers/${ownerId}`, title = "Discover Videos", sub = "Search by teacher name or topic to find the right videos", savedOnly = false, purchasedOnly = false, showSave = false }: {
  videoHref: (v: Video) => string; nameOf: (ownerId: string) => string; avatarOf?: (ownerId: string) => string | null; teacherHref?: (ownerId: string) => string;
  title?: string; sub?: string; savedOnly?: boolean; purchasedOnly?: boolean; showSave?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [acc, setAcc] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const saved = useSaved();
  const purchased = usePurchasedIds();
  const blocked = useBlockedIds();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const videos = useFetch(
    () => apiGet<Page<Video>>(`/api/v1/videos${qs({ search: submitted || undefined, limit: savedOnly || purchasedOnly ? 100 : PAGE_SIZE, page: savedOnly || purchasedOnly ? 1 : page })}`),
    [submitted, page, savedOnly, purchasedOnly],
  );

  // New search / mode → start over from page 1.
  useEffect(() => {
    setPage(1);
    setAcc([]);
    setTotal(0);
    setVisibleCount(PAGE_SIZE);
  }, [submitted, savedOnly, purchasedOnly]);

  // Accumulate server pages (dedupe by id; page 1 replaces).
  useEffect(() => {
    const d = videos.data;
    if (!d) return;
    setTotal(d.total ?? 0);
    setAcc((prev) => {
      if (page === 1) return d.items ?? [];
      const seen = new Set(prev.map((v) => String(v._id)));
      return [...prev, ...(d.items ?? []).filter((v) => !seen.has(String(v._id)))];
    });
  }, [videos.data, page]);

  const filtered = useMemo(() => {
    let mine = acc.filter((v) => !blocked.ids.has(String(v.ownerId)));
    if (savedOnly) mine = mine.filter((v) => saved.ids.has(saveKey("video", String(v._id))));
    if (purchasedOnly) {
      mine = mine
        .filter((v) => purchased.map.has(purchaseKey("video", String(v._id))))
        .sort((a, b) => +new Date(purchased.map.get(purchaseKey("video", String(b._id))) ?? "") - +new Date(purchased.map.get(purchaseKey("video", String(a._id))) ?? ""));
    }
    return mine;
  }, [acc, savedOnly, purchasedOnly, saved.ids, purchased.map, blocked.ids]);

  const shown = savedOnly || purchasedOnly ? filtered.slice(0, visibleCount) : filtered;
  const hasMore = savedOnly || purchasedOnly ? visibleCount < filtered.length : acc.length < total;

  // Infinite scroll: next server page, or reveal 16 more saved/purchased rows.
  useEffect(() => {
    if (!hasMore || videos.loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (savedOnly || purchasedOnly) setVisibleCount((c) => c + PAGE_SIZE);
          else setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, videos.loading, savedOnly, purchasedOnly]);

  const loading = videos.loading || (savedOnly && saved.loading) || (purchasedOnly && purchased.loading);
  const showInitial = loading && acc.length === 0;

  return (
    <section aria-label={title}>
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      <form className="mt-4 flex gap-3" role="search"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(search.trim()); }}>
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr-only" htmlFor="discover-video-search">Search by teacher name or topic</label>
          <input id="discover-video-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by teacher name or topic…" className="w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70" />
        </div>
        <button type="submit" className="rounded-lg bg-[#16a34a] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">Search</button>
      </form>
      <div className="mt-5">
        {showInitial ? <Loading label="Loading videos…" /> :
          videos.error ? <ErrorBox message={videos.error} onRetry={videos.retry} /> :
          !shown.length ? (savedOnly
            ? <Empty title="No saved videos yet" body="Tap the bookmark icon on any video to keep it here for later." />
            : purchasedOnly
              ? <Empty title="No purchased videos yet" body="Paid videos you buy will appear here, recent first." />
              : <Empty title="No videos found" body={submitted ? `Nothing matched “${submitted}”.` : "No published videos yet. Check back soon."} />) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map((v) => (
                <article key={String(v._id)} className="h-full overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                  <Link href={videoHref(v)} className="block" aria-label={v.title}>
                    {v.youtubeId
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                      : <div className="flex aspect-video w-full items-center justify-center bg-soft px-4 text-center text-sm font-semibold text-muted">{v.title}</div>}
                  </Link>
                  <div className="p-3.5">
                    <Link href={videoHref(v)} className="line-clamp-1 font-bold hover:text-brandstrong">{v.title}</Link>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Link href={teacherHref(v.ownerId)} className="flex min-w-0 items-center gap-2 text-[13px] text-muted hover:text-brandstrong" aria-label={`View ${nameOf(v.ownerId)}'s profile`}>
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-[11px] font-bold">
                          {avatarOf(v.ownerId) ? (
                            <AvatarImg uploadId={avatarOf(v.ownerId)} name={nameOf(v.ownerId)} className="h-full w-full" />
                          ) : (
                            initialsOf(nameOf(v.ownerId))
                          )}
                        </span>
                        <span className="truncate">{nameOf(v.ownerId)}</span>
                      </Link>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className={`rounded-md px-2.5 py-1 text-[13px] font-bold ${v.price > 0 ? "bg-[#ffedd5] text-[#c2410c]" : "bg-[#dcfce7] text-[#16a34a]"}`}>
                          {v.price > 0 ? `৳ ${v.price}` : "Free"}
                        </span>
                        {showSave && <SaveButton targetType="video" targetId={String(v._id)} />}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="py-6">
                  <Loading label="Loading more videos…" />
                </div>
              )}
            </>
          )}
      </div>
    </section>
  );
}

export function PracticeTests({ testHref, nameOf, avatarOf = () => null, teacherHref = (ownerId: string) => `/student/teachers/${ownerId}`, actionLabel, title = "Practice with Tests", sub = "Find and attempt quizzes, written exams, and projects from your favorite teachers.", from, savedOnly = false, purchasedOnly = false, showSave = false }: {
  testHref: (t: TestRow) => string; nameOf: (ownerId: string) => string; avatarOf?: (ownerId: string) => string | null; teacherHref?: (ownerId: string) => string; actionLabel: string;
  title?: string; sub?: string; from?: string; savedOnly?: boolean; purchasedOnly?: boolean; showSave?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState<"" | "quiz" | "written" | "problem" | "project">("");
  const saved = useSaved();
  const purchased = usePurchasedIds();
  const blocked = useBlockedIds();
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ search: debounced || undefined, limit: savedOnly || purchasedOnly ? 100 : 20 })}`), [debounced, savedOnly, purchasedOnly]);
  const assignments = useFetch(() => apiGet<Page<Assignment>>(`/api/v1/assignments${qs({ search: debounced || undefined, limit: savedOnly || purchasedOnly ? 100 : 20 })}`), [debounced, savedOnly, purchasedOnly]);

  const rows = useMemo<TestRow[]>(() => {
    const list: TestRow[] = [
      ...(exams.data?.items ?? []).map((e) => ({
        id: String(e._id), source: "exam" as const, kind: e.kind ?? "quiz", title: e.title, description: e.description ?? "",
        price: e.price ?? 0, currency: e.currency ?? "BDT",
        durationMinutes: e.kind === "project" ? null : (e.durationMinutes ?? null),
        deadline: e.kind === "project" ? (e.endsAt ?? null) : null,
        ownerId: e.ownerId, createdAt: e.createdAt,
      })),
      ...(assignments.data?.items ?? []).map((a) => ({
        id: String(a._id), source: "assignment" as const, kind: "project", title: a.title, description: a.description ?? "",
        price: a.price ?? 0, currency: a.currency ?? "BDT",
        durationMinutes: null, deadline: a.dueAt ?? null, ownerId: a.ownerId, createdAt: a.createdAt,
      })),
    ];
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const filtered = (kind ? list.filter((r) => r.kind === kind) : list).filter((r) => !blocked.ids.has(String(r.ownerId)));
    let mine = savedOnly ? filtered.filter((r) => saved.ids.has(saveKey(r.source, r.id))) : filtered;
    if (purchasedOnly) {
      mine = filtered
        .filter((r) => purchased.map.has(purchaseKey(r.source, r.id)))
        .sort((a, b) => +new Date(purchased.map.get(purchaseKey(b.source, b.id)) ?? "") - +new Date(purchased.map.get(purchaseKey(a.source, a.id)) ?? ""));
    }
    return mine.slice(0, savedOnly || purchasedOnly ? 100 : 8);
  }, [exams.data, assignments.data, kind, savedOnly, purchasedOnly, saved.ids, purchased.map, blocked.ids]);

  const loading = exams.loading || assignments.loading || (savedOnly && saved.loading) || (purchasedOnly && purchased.loading);
  const error = exams.error || assignments.error;

  return (
    <section aria-label={title}>
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr-only" htmlFor="discover-test-search">Search by YouTube URL, teacher name or topic</label>
          <input id="discover-test-search" value={search}
            onChange={(e) => { setSearch(e.target.value); const v = e.target.value.trim(); setTimeout(() => setDebounced(v), 350); }}
            placeholder="Search by YouTube URL, teacher name or topic …" className="w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted">Sort by</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "" | "quiz" | "written" | "problem" | "project")}
            className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-semibold outline-none">
            <option value="">All</option>
            <option value="quiz">Quiz</option>
            <option value="written">Written Exam</option>
            <option value="problem">Problem</option>
            <option value="project">Project</option>
          </select>
        </label>
      </div>
      <div className="mt-4">
        {loading ? <Loading label="Loading tests…" /> :
          error ? <ErrorBox message={error} onRetry={() => { exams.retry(); assignments.retry(); }} /> :
          !rows.length ? (savedOnly
            ? <Empty title="No saved tests yet" body="Tap the bookmark icon on any test to keep it here for later." />
            : purchasedOnly
              ? <Empty title="No purchased tests yet" body="Paid tests you buy will appear here, recent first." />
              : <Empty title="No tests found" body="No published tests yet. Check back soon." />) : (
            <ol className="divide-y divide-line rounded-xl border border-line bg-card">
              {rows.map((t) => {
                const meta = KIND_META[t.kind] ?? KIND_META.quiz!;
                const teacher = nameOf(t.ownerId);
                const href = testHref(t);
                const finalHref = from ? `${href}${href.includes("?") ? "&" : "?"}from=${from}` : href;
                return (
                  <li key={`${t.kind}-${t.id}`} className="flex flex-row flex-wrap items-center gap-3 p-4 lg:gap-5">
                    <div className="flex min-w-[200px] flex-1 items-start gap-3">
                      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.box}`}>{meta.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{t.title}</span>
                        <span className="mt-0.5 block truncate text-sm text-muted">
                          {t.description ? (t.description.length > 70 ? `${t.description.slice(0, 70).trimEnd()}…` : t.description) : "No description."}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {t.durationMinutes !== null ? `${t.durationMinutes} minutes` : t.deadline ? `Due ${fmtDate(t.deadline)}` : "Project based"}
                        </span>
                      </span>
                      <span className="shrink-0 self-center"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${meta.badge}`}>{meta.label}</span></span>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-4">
                      <Link href={teacherHref(t.ownerId)} className="flex items-center gap-2.5 hover:text-brandstrong" aria-label={`View ${teacher}'s profile`}>
                        <span aria-hidden className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-soft text-xs font-bold">
                          {avatarOf(t.ownerId) ? (
                            <AvatarImg uploadId={avatarOf(t.ownerId)} name={teacher} className="h-full w-full" />
                          ) : (
                            initialsOf(teacher)
                          )}
                        </span>
                        <span className="block whitespace-nowrap text-[13px] font-semibold">{teacher}</span>
                      </Link>
                      <span className={`rounded-md px-2.5 py-1 text-[13px] font-bold ${t.price > 0 ? "bg-[#ffedd5] text-[#c2410c]" : "bg-[#dcfce7] text-[#16a34a]"}`}>
                        {t.price > 0 ? `৳ ${t.price}` : "Free"}
                      </span>
                      <span className="flex items-center gap-1">
                        {showSave && <SaveButton targetType={t.source} targetId={t.id} />}
                        <Link href={finalHref} className="rounded-lg bg-[#16a34a] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#15803d]">{actionLabel}</Link>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
      </div>
    </section>
  );
}

export function PlaylistSlider({ title = "Playlists", sub = "", filter = "all", showSave = false, from, teacherHref = (ownerId: string) => `/student/teachers/${ownerId}` }: {
  title?: string; sub?: string; filter?: "all" | "saved" | "purchased"; showSave?: boolean; from?: string; teacherHref?: (ownerId: string) => string;
}) {
  const saved = useSaved();
  const purchased = usePurchasedIds();
  const blocked = useBlockedIds();
  const { nameOf, avatarOf } = useTeacherProfiles();
  const trackRef = useRef<HTMLDivElement>(null);
  const playlists = useFetch(
    () => apiGet<Page<Playlist>>(`/api/v1/playlists${qs({ limit: filter === "all" ? 20 : 100 })}`),
    [filter],
  );
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ limit: 100 })}`), []);
  const videoById = useMemo(
    () => new Map((videos.data?.items ?? []).map((v) => [String(v._id), v])),
    [videos.data],
  );
  // Playlist thumbnail = first video in the list that has a YouTube thumbnail.
  const thumbOf = (p: Playlist) => {
    for (const id of p.videoIds ?? []) {
      const yt = videoById.get(String(id))?.youtubeId;
      if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    }
    return null;
  };

  const items = useMemo(() => {
    const all = (playlists.data?.items ?? []).filter((p) => !blocked.ids.has(String(p.ownerId)));
    if (filter === "saved") return all.filter((p) => saved.ids.has(saveKey("playlist", String(p._id))));
    if (filter === "purchased") {
      return all
        .filter((p) => purchased.map.has(purchaseKey("playlist", String(p._id))))
        .sort((a, b) => +new Date(purchased.map.get(purchaseKey("playlist", String(b._id))) ?? "") - +new Date(purchased.map.get(purchaseKey("playlist", String(a._id))) ?? ""));
    }
    return all;
  }, [playlists.data, filter, saved.ids, purchased.map, blocked.ids]);

  const loading = playlists.loading || videos.loading || (filter === "saved" && saved.loading) || (filter === "purchased" && purchased.loading);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 280), behavior: "smooth" });
  };

  return (
    <section aria-label={title} className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
          {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll playlists left"
            className="rounded-full border border-line bg-card p-2 text-muted hover:bg-soft hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll playlists right"
            className="rounded-full border border-line bg-card p-2 text-muted hover:bg-soft hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
      <div className="mt-4">
        {loading ? <Loading label="Loading playlists…" /> :
          playlists.error ? <ErrorBox message={playlists.error} onRetry={playlists.retry} /> :
          !items.length ? (
            filter === "saved"
              ? <Empty title="No saved playlists yet" body="Tap the bookmark icon on any playlist to keep it here." />
              : filter === "purchased"
                ? <Empty title="No purchased playlists yet" body="Paid playlists you buy will appear here, recent first." />
                : <Empty title="No playlists yet" body="Teachers have not published playlists yet." />
          ) : (
            <div ref={trackRef} className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2">
              {items.map((p) => (
                <div key={String(p._id)} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                  <PlaylistCard
                    playlist={p}
                    thumbnailUrl={thumbOf(p)}
                    href={from ? `/student/playlists/${String(p._id)}?from=${from}` : `/student/playlists/${String(p._id)}`}
                    action={showSave ? <SaveButton targetType="playlist" targetId={String(p._id)} /> : undefined}
                    creator={{ name: nameOf(p.ownerId), avatarUploadId: avatarOf(p.ownerId), href: teacherHref(p.ownerId) }}
                  />
                </div>
              ))}
            </div>
          )}
      </div>
    </section>
  );
}
