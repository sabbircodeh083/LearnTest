"use client";
import { use } from "react";
import Link from "next/link";
import { Badge, Btn, ErrorBox, Loading, statusTone, useToast } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate } from "@/lib/types";

interface ReportRow { _id: string; reporterId: string; reason: string; status: string; createdAt: string }
interface ContentDetail {
  doc: Record<string, any>;
  owner: { userId: string; email: string; name: string; status: string } | null;
  reportCount: number;
  recentReports: ReportRow[];
}

export default function AdminReportedContentPage({ params }: { params: Promise<{ targetType: string; targetId: string }> }) {
  const { targetType, targetId } = use(params);
  const toast = useToast();
  const { promptReason } = useDialog();
  const { data, error, loading, retry } = useFetch(
    () => apiGet<ContentDetail>(`/api/v1/admin/content/${targetType}/${targetId}`),
    [targetType, targetId],
  );

  const moderate = async (action: "hide" | "restore" | "reject") => {
    const reason = await promptReason({ title: `${action.charAt(0).toUpperCase()}${action.slice(1)} this ${targetType}?`, label: "Reason (required, at least 3 characters)", confirmLabel: "Save moderation", danger: action !== "restore" });
    if (!reason) return;
    try {
      await apiPatch(`/api/v1/admin/content/${targetType}/${targetId}/moderation`, { action, reason });
      toast("Moderation saved.");
      retry();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Moderation failed.", "err"); }
  };

  if (loading) return <Loading label="Loading reported content…" />;
  if (error) return (
    <div>
      <Link href="/admin/reports" className="text-sm font-semibold text-brandstrong">← Reports</Link>
      <div className="mt-4"><ErrorBox message={error} onRetry={retry} /></div>
    </div>
  );
  if (!data) return <ErrorBox message="Content not found." onRetry={retry} />;

  const d = data.doc;
  const title = d.title ?? d.prompt ?? `Untitled ${targetType}`;
  const body = d.description ?? d.prompt ?? d.content ?? "";

  return (
    <div>
      <Link href="/admin/reports" className="text-sm font-semibold text-brandstrong">← Reports</Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="blue">{targetType}</Badge>
        <Badge tone={statusTone(d.status ?? d.moderationState ?? "published")}>{d.status ?? d.moderationState ?? "—"}</Badge>
        <Badge tone="amber">{data.reportCount} report{data.reportCount === 1 ? "" : "s"}</Badge>
        <span className="text-xs text-muted">ID {targetId} · Updated {fmtDate(d.updatedAt)} · Created {fmtDate(d.createdAt)}</span>
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{title}</h1>
      {body ? <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{body}</p> : null}

      {data.owner ? (
        <p className="mt-3 text-sm">
          <span className="text-muted">Owner: </span>
          <Link href={`/admin/users/${data.owner.userId}?from=reports`} className="font-semibold text-brandstrong hover:underline">
            {data.owner.name || data.owner.email || data.owner.userId}
          </Link>
          <span className="text-muted"> ({data.owner.email})</span>
        </p>
      ) : null}

      {d.youtubeId ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-black">
          <iframe title={title} className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${d.youtubeId}`} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="ghost" onClick={() => moderate("hide")}>Hide content</Btn>
        <Btn variant="ghost" onClick={() => moderate("restore")}>Restore</Btn>
        <Btn variant="danger" onClick={() => moderate("reject")}>Reject content</Btn>
      </div>

      <h2 className="mt-6 font-display text-lg font-bold">Recent reports ({data.recentReports.length})</h2>
      {data.recentReports.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No reports found for this item.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {data.recentReports.map((r) => (
            <li key={r._id} className="rounded-xl border border-line bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{r.status}</Badge>
                <span className="text-xs text-muted">{fmtDate(r.createdAt)} · Reporter {r.reporterId}</span>
              </div>
              <p className="mt-1.5 text-sm">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
