"use client";
import { use } from "react";
import { PlaylistForm } from "@/components/PlaylistForm";
import { ErrorBox, Loading } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Playlist } from "@/lib/types";

export default function EditPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useFetch(() => apiGet<Playlist>(`/api/v1/playlists/${id}`), [id]);

  if (loading) return <Loading label="Loading playlist…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!data) return <ErrorBox message="Playlist not found." onRetry={retry} />;
  return <PlaylistForm initial={data} />;
}
