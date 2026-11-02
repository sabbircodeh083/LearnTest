"use client";
import { useState } from "react";
import { PageHead } from "@/components/ui";
import { DiscoverVideos, ModeToggle, PlaylistSlider, PracticeTests, useTeacherProfiles, type DiscoverMode } from "@/components/discover";
import type { Video } from "@/lib/types";

const MODE_KEY = "learntest-purchases-mode";

function initialPurchasesMode(): DiscoverMode {
  if (typeof window === "undefined") return "videos";
  const m = window.localStorage.getItem(MODE_KEY);
  return m === "tests" || m === "playlists" ? m : "videos";
}

export default function PurchasesPage() {
  const [mode, setMode] = useState<DiscoverMode>(initialPurchasesMode);
  const { nameOf, avatarOf } = useTeacherProfiles();

  const changeMode = (m: DiscoverMode) => {
    setMode(m);
    try { window.localStorage.setItem(MODE_KEY, m); } catch { /* private mode — session default */ }
  };

  return (
    <div>
      <PageHead title="Purchased Content" sub="Videos and tests you purchased." />
      <ModeToggle mode={mode} onChange={changeMode} videosTitle="Purchased Videos" testsTitle="Purchased Tests" playlistsTitle="Purchased Playlists" />

      <div className="pb-10">
        {mode === "videos" ? (
          <DiscoverVideos
            videoHref={(v: Video) => `/student/videos/${String(v._id)}?from=purchases`}
            nameOf={nameOf}
            avatarOf={avatarOf}
            title="Purchased Videos"
            sub=""
            purchasedOnly
          />
        ) : mode === "tests" ? (
          <PracticeTests
            testHref={(t) => `/student/tests/${t.id}?source=${t.source}`}
            nameOf={nameOf}
            avatarOf={avatarOf}
            actionLabel="Attempt Test"
            from="purchases"
            title="Purchased Tests"
            sub=""
            purchasedOnly
          />
        ) : (
          <PlaylistSlider title="Purchased Playlists" filter="purchased" from="purchases" />
        )}
      </div>
    </div>
  );
}
