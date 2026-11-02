"use client";
import { useState } from "react";
import { Badge, Empty, ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, fmtMoney, type Page } from "@/lib/types";

const TYPES = [
  { value: "", label: "All types" },
  { value: "quiz", label: "Quiz" },
  { value: "written", label: "Written" },
  { value: "problem", label: "Problem" },
  { value: "project", label: "Project" },
  { value: "video", label: "Video" },
  { value: "playlist", label: "Playlist" },
] as const;
const PAGE_SIZE = 10;

interface StatementItem {
  purchaseId: string;
  tranId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string | null;
  studentId: string;
  content: { contentType: string; contentId: string; title: string; teacherId: string; kind: string };
}

const TYPE_LABEL: Record<string, string> = {
  video: "Video",
  playlist: "Playlist",
  question: "Question",
  exam: "Test (exam)",
  assignment: "Project (assignment)",
};

/** Short type shown in the table's Type column. */
const kindLabel = (it: StatementItem) => {
  const k = it.content.kind;
  if (k === "quiz" || k === "written" || k === "problem" || k === "project") {
    return k.charAt(0).toUpperCase() + k.slice(1);
  }
  return TYPE_LABEL[it.content.contentType] ?? it.content.contentType;
};

function statusTone(status: string) {
  if (status === "paid") return "bg-[#1a3a26] text-[#4ade80]";
  if (status === "pending") return "bg-[#3a2f10] text-[#facc15]";
  return "bg-[#3a1d1d] text-[#f87171]";
}

function DetailsModal({ item, onClose }: { item: StatementItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment details">
      <button type="button" aria-label="Close payment details" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Payment Details</h2>
            <p className="mt-0.5 break-all font-mono text-xs text-muted">{item.tranId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-soft">✕</button>
        </div>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Date</dt>
            <dd className="font-medium">{fmtDate(item.createdAt)}</dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Amount</dt>
            <dd className="font-bold">{fmtMoney(item.amount, item.currency)}</dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Status</dt>
            <dd><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span></dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Transaction ID</dt>
            <dd className="break-all font-mono text-xs">{item.tranId}</dd>
          </div>
        </dl>
        <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Content Type</dt>
            <dd>
              <span className="font-bold">{TYPE_LABEL[item.content.contentType] ?? item.content.contentType}</span>
              {item.content.title && <span className="block text-muted">{item.content.title}</span>}
            </dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Content ID</dt>
            <dd className="break-all font-mono text-xs">{item.content.contentId}</dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Teacher ID</dt>
            <dd className="break-all font-mono text-xs">{item.content.teacherId || "—"}</dd>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <dt className="text-muted">Paying Student ID</dt>
            <dd className="break-all font-mono text-xs">{item.studentId}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function PurchaseStatementsPage() {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StatementItem | null>(null);

  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<StatementItem>>(`/api/v1/purchases/statement${qs({ search: submitted || undefined, type: type || undefined, page, limit: PAGE_SIZE })}`),
    [submitted, type, page],
  );

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  return (
    <div>
      <PageHead title="Purchased Statements" sub="Every payment you made, with transaction status." />
      <form className="mt-4 flex flex-wrap items-center gap-3" role="search"
        onSubmit={(e) => { e.preventDefault(); setPage(1); setSubmitted(search.trim()); }}>
        <label className="sr-only" htmlFor="statement-search">Search by content title</label>
        <input id="statement-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by content title…" className="min-w-[240px] flex-1 rounded-lg border border-line bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted/70 sm:max-w-xs" />
        <button type="submit" className="rounded-lg bg-[#16a34a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">Search</button>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted">Type</span>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-semibold outline-none" aria-label="Filter by content type">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </form>

      <div className="mt-4">
        {loading ? <Loading label="Loading statements…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
          !items.length ? <Empty title="No payments found" body={submitted || type ? "Nothing matches this search." : "You have not made any payments yet."} /> : (
            <>
              <div className="overflow-x-auto rounded-xl border border-line bg-card">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-muted">
                      <th className="px-4 py-3 font-semibold">Content</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((it) => (
                      <tr key={it.purchaseId}>
                        <td className="max-w-[240px] px-4 py-3">
                          <span className="block truncate font-semibold">{it.content.title || "—"}</span>
                          <span className="text-xs text-muted">{TYPE_LABEL[it.content.contentType] ?? it.content.contentType}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{fmtDate(it.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{fmtMoney(it.amount, it.currency)}</td>
                        <td className="whitespace-nowrap px-4 py-3"><Badge>{kindLabel(it)}</Badge></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusTone(it.status)}`}>{it.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setSelected(it)}
                            className="rounded-lg border border-line bg-card px-4 py-1.5 text-[13px] font-semibold hover:bg-soft">Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold hover:bg-soft disabled:opacity-50">Previous</button>
                <p className="text-sm text-muted">Page {page} of {pages} · {total} payment{total === 1 ? "" : "s"}</p>
                <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                  className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold hover:bg-soft disabled:opacity-50">Next</button>
              </div>
            </>
          )}
      </div>
      {selected && <DetailsModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
