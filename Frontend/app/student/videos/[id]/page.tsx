"use client";
import { Suspense, use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, ErrorBox, Loading, useToast, Btn } from "@/components/ui";
import { BuyPanel, Engagement } from "@/components/purchase";
import { TestsExamsTable } from "@/components/LinkedTests";
import { SaveButton } from "@/lib/saved";
import { apiGet, apiPost, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Exam, type Page, type Video } from "@/lib/types";

function VideoDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const fromParam = search.get("from");
  const backHref =
    fromParam === "home" ? "/student" : fromParam === "saved" ? "/student/saved-content" : fromParam === "purchases" ? "/student/purchases" : "/student/my-learning";
  const backLabel =
    fromParam === "home" ? "Learn with Videos" : fromParam === "saved" ? "Saved Content" : fromParam === "purchases" ? "Purchased Content" : "My Learning";
  const toast = useToast();
  const { data: v, error, loading, retry } = useFetch(() => apiGet<Video>(`/api/v1/videos/${id}`), [id]);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 100 })}`), []);
  const linkedTests = useMemo(() => {
    if (!v) return [];
    const yt = v.youtubeId;
    const cid = String(v._id);
    return (exams.data?.items ?? []).filter((e) => e.videoId && (e.videoId === yt || e.videoId === cid));
  }, [exams.data, v]);

  if (loading) return <Loading label="Loading video…" />;
  if (error) return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>
      <div className="mt-4"><ErrorBox message={error} onRetry={retry} /></div>
      <p className="mt-3 text-sm text-muted">If this video is paid, you may need to purchase it first. Free published videos open without payment.</p>
    </div>
  );
  if (!v) return <ErrorBox message="Video not found." onRetry={retry} />;

  const report = async () => {
    const reason = window.prompt("Why are you reporting this video? (at least 3 characters)");
    if (!reason) return;
    try { await apiPost("/api/v1/reports", { targetType: "video", targetId: v._id, reason }); toast("Report sent for review."); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not send report.", "err"); }
  };

  return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">{v.title}</h1>
      <p className="mt-1 text-sm text-muted">Published {fmtDate(v.createdAt)}</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-black">
        {v.sourceType === "youtube" && v.youtubeId ? (
          <iframe title={v.title} className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
            allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <div className="flex aspect-video items-center justify-center p-6 text-center text-sm text-white/80">
            This is an uploaded video. Playback needs an authorized file download from the teacher — ask them for access if the player is unavailable.
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {v.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
        <Badge>{v.sourceType === "youtube" ? "YouTube" : "Upload"}</Badge>
      </div>
      <p className="mt-4 whitespace-pre-wrap leading-relaxed text-muted">{v.description || "No description provided."}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <BuyPanel contentType="video" contentId={v._id} price={v.price} currency={v.currency} />
        <SaveButton targetType="video" targetId={String(v._id)} />
        <Btn variant="ghost" onClick={report}>Report</Btn>
      </div>
      <Engagement targetType="video" targetId={v._id} />
      <TestsExamsTable tests={linkedTests} />
    </div>
  );
}

export default function VideoDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading video…" />}>
      <VideoDetailInner params={params} />
    </Suspense>
  );
}
