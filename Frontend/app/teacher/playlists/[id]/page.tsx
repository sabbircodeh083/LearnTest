"use client";
import { use } from "react";
import { ContentForm, type ContentInitial } from "@/components/ContentForm";
import { ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Playlist } from "@/lib/types";

export default function EditPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useFetch(() => apiGet<Playlist>(`/api/v1/playlists/${id}`), [id]);

  return (
    <div>
      <PageHead title="Edit playlist" sub="Update the details, videos, and pricing of this playlist." />
      {loading ? <Loading label="Loading playlist…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data ? <ErrorBox message="Playlist not found." onRetry={retry} /> : (
          <ContentForm kind="playlist" endpoint="/api/v1/playlists" initial={data as unknown as ContentInitial} backHref="/teacher/playlists" />
        )}
    </div>
  );
}
