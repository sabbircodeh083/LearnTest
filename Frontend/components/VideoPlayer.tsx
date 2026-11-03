"use client";
import { useEffect, useRef, useState } from "react";
import { API_BASE, apiBlobUrl } from "@/lib/api";

/** Minimal shape needed to render a video, shared by the student pages. */
export type PlayableVideo = {
  _id: string;
  title: string;
  sourceType: string;
  youtubeId?: string;
  mediaReady?: boolean;
  mediaStatus?: string | null;
};

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 p-6 text-center">
      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white">▶</span>
      <p className="max-w-md text-sm font-semibold text-white">{title}</p>
      <p className="max-w-md text-[13px] leading-snug text-white/70">{body}</p>
    </div>
  );
}

/**
 * Plays YouTube videos via the privacy-friendly embed and uploaded videos via
 * the authorized, byte-range backend stream. Range support is what lets the
 * browser buffer progressively and seek instead of downloading everything.
 */
export function VideoPlayer({ video }: { video: PlayableVideo }) {
  const [failed, setFailed] = useState(false);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const triedBlob = useRef(false);

  // Release the fallback object URL when the source changes or on unmount.
  useEffect(() => () => { if (blobSrc) URL.revokeObjectURL(blobSrc); }, [blobSrc]);
  useEffect(() => { setFailed(false); setBlobSrc(null); triedBlob.current = false; }, [video._id]);

  if (video.sourceType === "youtube" && video.youtubeId) {
    return (
      <iframe
        title={video.title}
        className="aspect-video w-full"
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  const mediaPath = `/api/v1/videos/${encodeURIComponent(video._id)}/media`;

  if (video.sourceType === "upload" && video.mediaReady === false) {
    const scanning = video.mediaStatus === "pending_scan" || video.mediaStatus === "scanning";
    return scanning
      ? <Message title="This video is still being checked." body="It becomes playable as soon as the safety scan finishes. Refresh this page in a minute." />
      : <Message title="This video is not available yet." body="The uploaded file is not ready for playback. Ask the teacher to re-upload it or check back later." />;
  }

  if (failed) {
    return <Message title="This video can't be played here." body="Your access may have expired, or the file's codec isn't supported by this browser (H.264 + AAC MP4 plays everywhere). Ask the teacher to check the upload." />;
  }

  // Primary: direct stream (Range → progressive buffering). If the browser
  // blocks cross-origin media in this environment, fetch it once as a blob and
  // play that instead — same authorization, no public URL involved.
  const onError = async () => {
    if (!triedBlob.current) {
      triedBlob.current = true;
      try {
        const url = await apiBlobUrl(mediaPath);
        setBlobSrc(url);
        return;
      } catch { /* fall through to the message */ }
    }
    setFailed(true);
  };

  return (
    <video
      key={blobSrc ?? "stream"}
      className="aspect-video w-full bg-black"
      src={blobSrc ?? `${API_BASE}${mediaPath}`}
      controls
      playsInline
      preload="metadata"
      crossOrigin={blobSrc ? undefined : "use-credentials"}
      onError={onError}
    />
  );
}
