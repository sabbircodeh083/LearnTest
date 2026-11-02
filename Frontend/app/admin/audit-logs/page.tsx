"use client";
import { useState } from "react";
import { Btn, Empty, ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Page } from "@/lib/types";

interface AuditDoc { _id: string; actorId: string; action: string; resourceType: string; resourceId: string; outcome: string; reason: string; createdAt: string }

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, error, loading, retry } = useFetch(() => apiGet<Page<AuditDoc>>(`/api/v1/admin/audit-logs${qs({ page, limit })}`), [page]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  return (
    <div>
      <PageHead title="Audit logs" sub="Who did what, with the recorded reason. Newest first." />
      {loading ? <Loading label="Loading audit logs…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No audit entries" body="Admin actions with reasons will appear here." /> : (
          <>
            <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-soft text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Reason</th></tr></thead>
              <tbody>{data.items.map((a) => <tr key={a._id} className="border-t border-line"><td className="px-4 py-3 text-muted">{fmtDate(a.createdAt)}</td><td className="px-4 py-3 font-medium">{a.action}</td><td className="px-4 py-3 text-muted">{a.resourceType} {a.resourceId}</td><td className="px-4 py-3">{a.outcome}</td><td className="px-4 py-3 text-muted">{a.reason || "—"}</td></tr>)}</tbody>
            </table></div>
            <div className="mt-5 flex items-center gap-3"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn><span className="text-sm text-muted">Page {page} of {pages}</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn></div>
          </>
        )}
    </div>
  );
}
