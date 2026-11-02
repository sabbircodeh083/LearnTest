"use client";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, inputCls, Loading, PageHead, statusTone } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Payment ${purchase.tranId}`}>
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-xl">
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
      </div>
    </div>
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
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-soft text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Transaction</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Details</th></tr></thead>
                <tbody>{data.items.map((p) => (
                  <tr key={p._id} className="border-t border-line">
                    <td className="px-4 py-3">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{fmtMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{p.tranId}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(p.status)}>{p.status.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3 text-right"><Btn variant="ghost" onClick={() => setSelected(p)}>Details</Btn></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-5 flex items-center gap-3"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn><span className="text-sm text-muted">Page {page} of {pages} · {data.total} payments</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn></div>
          </>
        )}
      {selected && <DetailsModal purchase={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
