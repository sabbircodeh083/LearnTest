"use client";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, inputCls, Loading, PageHead, statusTone } from "@/components/ui";
import { DataList, DataRow, RowIcon } from "@/components/DataList";
import { apiGet, qs } from "@/lib/api";
import { ModalShell } from "@/components/AlertDialog";
import { useFetch } from "@/lib/hooks";
import { fmtDate, fmtMoney, type Page, type Purchase } from "@/lib/types";

interface PurchaseDetail {
  purchase: Purchase;
  content?: { contentType: string; contentId: string; title: string; teacherId: string };
}

const kindLabel = (t: string) => (t === "video" || t === "playlist" ? "Video" : "Test");

function DetailsModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { data, error, loading, retry } = useFetch(
    () => apiGet<PurchaseDetail>(`/api/v1/admin/purchases/${purchase._id}`), [purchase._id]);
  const content = data?.content;
  return (
    <ModalShell label={`Payment ${purchase.tranId}`} onClose={onClose} maxWidth="max-w-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Payment Details</h2>
            <p className="mt-0.5 break-all font-mono text-xs text-muted">{purchase.tranId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-soft">✕</button>
        </div>

        <dl className="mt-4 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="text-muted">Date</dt><dd>{fmtDate(purchase.createdAt)}</dd>
          <dt className="text-muted">Amount</dt><dd className="font-semibold">{fmtMoney(purchase.amount, purchase.currency)}</dd>
          <dt className="text-muted">Status</dt><dd><Badge tone={statusTone(purchase.status)}>{purchase.status.replace("_", " ")}</Badge></dd>
          <dt className="text-muted">Transaction ID</dt><dd className="break-all font-mono text-xs">{purchase.tranId}</dd>
        </dl>

        <div className="mt-4 border-t border-line pt-4">
          {loading ? <Loading label="Loading content details…" />
            : error ? <ErrorBox message={error} onRetry={retry} />
            : (
              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-muted">Content Type</dt>
                <dd className="font-semibold">
                  {kindLabel(content?.contentType ?? purchase.contentType)}
                  <span className="ml-1.5 font-normal capitalize text-muted">({content?.contentType ?? purchase.contentType})</span>
                  {content?.title && <span className="block font-normal text-muted">{content.title}</span>}
                </dd>
                <dt className="text-muted">Content ID</dt><dd className="break-all font-mono text-xs">{content?.contentId ?? purchase.contentId}</dd>
                <dt className="text-muted">Teacher ID</dt><dd className="break-all font-mono text-xs">{content?.teacherId || "—"}</dd>
                <dt className="text-muted">Paying Student ID</dt><dd className="break-all font-mono text-xs">{purchase.userId}</dd>
              </dl>
            )}
        </div>
    </ModalShell>
  );
}

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const limit = 15;
  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<Purchase>>(`/api/v1/admin/payments${qs({ status, tranId: submitted, page, limit })}`), [status, submitted, page]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  return (
    <div>
      <PageHead title="Payments" sub="All purchases across the platform. Gateway-validated fields only — admins cannot rewrite payment outcomes here." />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSubmitted(search.trim()); }}>
          <label className="sr-only" htmlFor="admin-payment-search">Search by transaction ID</label>
          <input id="admin-payment-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by transaction ID…" className={inputCls} />
          <Btn type="submit">Search</Btn>
          {submitted && <Btn variant="ghost" onClick={() => { setSearch(""); setSubmitted(""); setPage(1); }}>Clear</Btn>}
        </form>
        <label className="flex items-center gap-2 text-sm">Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
            <option value="">All statuses</option>{["pending", "paid", "failed", "cancelled", "expired", "risk_hold", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {loading ? <Loading label="Loading payments…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No payments found" body={submitted ? `No transaction matches “${submitted}”.` : "No purchases match this status."} /> : (
          <>
            <DataList label="Payments">
              {data.items.map((p) => (
                <DataRow
                  key={p._id}
                  icon={
                    <RowIcon tone="bg-[#e6f9ec] text-[#16a34a]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 8h10l1.5 12.5a1 1 0 0 1-1 1.1H6.5a1 1 0 0 1-1-1.1z" /><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" /></svg>
                    </RowIcon>
                  }
                  title={fmtMoney(p.amount, p.currency)}
                  meta={<>{fmtDate(p.createdAt)} · <span className="break-all font-mono text-xs">{p.tranId}</span></>}
                  chip={<Badge tone={statusTone(p.status)}>{p.status.replace("_", " ")}</Badge>}
                  actions={<Btn variant="ghost" onClick={() => setSelected(p)}>Details</Btn>}
                />
              ))}
            </DataList>
            <div className="mt-5 flex items-center gap-3"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn><span className="text-sm text-muted">Page {page} of {pages} · {data.total} payments</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn></div>
          </>
        )}
      {selected && <DetailsModal purchase={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
