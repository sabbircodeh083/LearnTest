"use client";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, Loading, PageHead } from "@/components/ui";
import { DataList, DataRow, RowIcon } from "@/components/DataList";
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
            <DataList label="Audit logs">
              {data.items.map((a) => (
                <DataRow
                  key={a._id}
                  icon={
                    <RowIcon tone="bg-soft text-muted">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>
                    </RowIcon>
                  }
                  title={a.action}
                  meta={<>{fmtDate(a.createdAt)} · <Badge tone={a.outcome === "success" ? "green" : "red"}>{a.outcome}</Badge></>}
                  detail={[(a.resourceType || a.resourceId) ? `${a.resourceType} ${a.resourceId}`.trim() : null, a.reason || null].filter(Boolean).join(" — ") || "—"}
                />
              ))}
            </DataList>
            <div className="mt-5 flex items-center gap-3"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn><span className="text-sm text-muted">Page {page} of {pages}</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn></div>
          </>
        )}
    </div>
  );
}
