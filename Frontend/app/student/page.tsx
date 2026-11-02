"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loading, PageHead } from "@/components/ui";
import { DiscoverVideos, ModeToggle, PlaylistSlider, PracticeTests, useTeacherProfiles, type DiscoverMode } from "@/components/discover";
import { useAuth } from "@/lib/auth";
import type { Video } from "@/lib/types";

const MODE_KEY = "learntest-discover-mode";

function initialMode(): DiscoverMode {
  if (typeof window === "undefined") return "videos";
  const m = window.localStorage.getItem(MODE_KEY);
  return m === "tests" || m === "playlists" ? m : "videos";
}

function tabParam(value: string | null): DiscoverMode | null {
  return value === "videos" || value === "tests" || value === "playlists" ? value : null;
}

function StudentHomeInner() {
  const search = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<DiscoverMode>(() => tabParam(search.get("tab")) ?? initialMode());
  const { nameOf, avatarOf } = useTeacherProfiles();
  const name = user?.name?.split(" ")[0] || "there";

  // Sidebar Videos / Playlist links land here with ?tab= — follow them.
  useEffect(() => {
    const t = tabParam(search.get("tab"));
    if (t) setMode(t);
  }, [search]);

  const changeMode = (m: DiscoverMode) => {
    setMode(m);
    try { window.localStorage.setItem(MODE_KEY, m); } catch { /* private mode — session default */ }
  };

  return (
    <div>
      <PageHead title={`Welcome back, ${name}`} sub="Learn from videos, then prove your knowledge with tests." />
      {!user?.emailVerified && (
        <p role="note" className="mb-5 rounded-xl bg-warnsoft px-4 py-3 text-sm text-warn">
          Your email is not verified yet. Some content stays locked until you open the verification link from your email.
        </p>
      )}

      <ModeToggle mode={mode} onChange={changeMode} />

      <div className="pb-10">
        {mode === "videos" ? (
          <DiscoverVideos videoHref={(v: Video) => `/student/videos/${String(v._id)}?from=home`} nameOf={nameOf} avatarOf={avatarOf} showSave />
        ) : mode === "tests" ? (
          <PracticeTests testHref={(t) => `/student/tests/${t.id}?source=${t.source}`} nameOf={nameOf} avatarOf={avatarOf} actionLabel="Attempt Test" from="home" showSave />
        ) : (
          <PlaylistSlider title="Playlists" showSave from="home" />
        )}
      </div>
    </div>
  );
}

export default function StudentHome() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <StudentHomeInner />
    </Suspense>
  );
}
