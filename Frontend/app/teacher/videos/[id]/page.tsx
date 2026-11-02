"use client";
import { use } from "react";
import { ContentForm, type ContentInitial } from "@/components/ContentForm";
import { ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Video } from "@/lib/types";

export default function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useFetch(() => apiGet<Video>(`/api/v1/videos/${id}`), [id]);

  return (
    <div>
      <PageHead title="Edit video" sub="Update the title, description, tags, pricing, visibility, and status of this video. The source (YouTube or uploaded file) cannot be changed after creation." />
      {loading ? <Loading label="Loading video…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data ? <ErrorBox message="Video not found." onRetry={retry} /> : (
          <ContentForm kind="video" endpoint="/api/v1/videos" initial={data as unknown as ContentInitial} backHref="/teacher/videos" />
        )}
    </div>
  );
}
