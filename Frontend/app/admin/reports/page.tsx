"use client";
import Link from "next/link";
import { Badge, Btn, Empty, ErrorBox, Loading, PageHead, useToast } from "@/components/ui";
import { apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Page } from "@/lib/types";

interface ReportDoc { _id: string; reporterId: string; targetType: string; targetId: string; reason: string; status: string; createdAt: string }

const isUserTarget = (t: string) => t === "teacher" || t === "user";

export default function AdminReportsPage() {
  const toast = useToast();
  const { data, error, loading, retry } = useFetch(() => apiGet<Page<ReportDoc>>(`/api/v1/admin/content/reports${qs({ limit: 30 })}`), []);
  const moderate = async (r: ReportDoc, action: "hide" | "restore" | "reject") => {
    const reason = window.prompt(`Reason for “${action}” on this ${r.targetType}? (required)`);
    if (!reason || reason.trim().length < 3) { if (reason !== null) toast("A reason of at least 3 characters is required.", "err"); return; }
    try { await apiPatch(`/api/v1/admin/content/${r.targetType}/${r.targetId}/moderation`, { action, reason: reason.trim() }); toast("Moderation saved."); retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Moderation failed.", "err"); }
  };
  return (
    <div>
      <PageHead title="Reports & moderation" sub="User reports. Hide, restore, or reject the reported content — every action needs a reason and is audit-logged." />
      {loading ? <Loading label="Loading reports…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No reports" body="No user reports are waiting." /> : (
          <ul className="space-y-3">{data.items.map((r) => (
            <li key={r._id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{r.targetType}</Badge><Badge>{r.status}</Badge><span className="text-xs text-muted">{fmtDate(r.createdAt)} · Target {r.targetId}</span></div>
              <p className="mt-2 text-sm">{r.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isUserTarget(r.targetType) ? (
                  <Link href={`/admin/users/${r.targetId}?from=reports`} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brandstrong">Open profile</Link>
                ) : (
                  <Link href={`/admin/reports/${r.targetType}/${r.targetId}`} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brandstrong">Open content</Link>
                )}
                <Btn variant="ghost" onClick={() => moderate(r, "hide")}>Hide content</Btn><Btn variant="ghost" onClick={() => moderate(r, "restore")}>Restore</Btn><Btn variant="danger" onClick={() => moderate(r, "reject")}>Reject content</Btn></div>
            </li>))}
          </ul>
        )}
    </div>
  );
}
