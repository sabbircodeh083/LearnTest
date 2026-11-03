"use client";
import { use } from "react";
import { VideoForm } from "@/components/VideoForm";
import { ErrorBox, Loading } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Video } from "@/lib/types";

export default function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useFetch(() => apiGet<Video>(`/api/v1/videos/${id}`), [id]);

  if (loading) return <Loading label="Loading video…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!data) return <ErrorBox message="Video not found." onRetry={retry} />;
  return <VideoForm initial={data} />;
}
