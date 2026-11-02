"use client";
import { useState } from "react";
import { PageHead } from "@/components/ui";
import {
  DiscoverVideos,
  ModeToggle,
  PlaylistSlider,
  PracticeTests,
  useTeacherProfiles,
  type DiscoverMode,
} from "@/components/discover";
import type { Video } from "@/lib/types";

const MODE_KEY = "learntest-saved-mode";

function initialSavedMode(): DiscoverMode {
  if (typeof window === "undefined") return "videos";
  const m = window.localStorage.getItem(MODE_KEY);
  return m === "tests" || m === "playlists" ? m : "videos";
}

export default function SavedContentPage() {
  const [mode, setMode] = useState<DiscoverMode>(initialSavedMode);
  const { nameOf, avatarOf } = useTeacherProfiles();

  const changeMode = (m: DiscoverMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode — session default */
    }
  };

  return (
    <div>
      <PageHead
        title="Saved Content"
        sub="Videos and tests you bookmarked for later."
      />
      <ModeToggle mode={mode} onChange={changeMode} videosTitle="Saved Videos" testsTitle="Saved Tests" playlistsTitle="Saved Playlists" />

      <div className="pb-10">
        {mode === "videos" ? (
          <DiscoverVideos
            videoHref={(v: Video) => `/student/videos/${String(v._id)}?from=saved`}
            nameOf={nameOf}
            avatarOf={avatarOf}
            title=""
            sub=""
            savedOnly
            showSave
          />
        ) : mode === "tests" ? (
          <PracticeTests
            testHref={(t) => `/student/tests/${t.id}?source=${t.source}`}
            nameOf={nameOf}
            avatarOf={avatarOf}
            actionLabel="Attempt Test"
            from="saved"
            title=""
            sub=""
            savedOnly
            showSave
          />
        ) : (
          <PlaylistSlider title="" filter="saved" showSave from="saved" />
        )}
      </div>
    </div>
  );
}
