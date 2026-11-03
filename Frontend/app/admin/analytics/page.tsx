"use client";
import { useState } from "react";
import { Btn, ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";

interface Analytics { from: string; to: string; newUsers: number; revenue: { _id: string; total: number; count: number }[]; purchasesByStatus: { _id: string; count: number }[] }

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const range = () => { const to = new Date(); const from = new Date(to.getTime() - days * 86400000); return `?from=${from.toISOString()}&to=${to.toISOString()}`; };
  const { data, error, loading, retry } = useFetch(() => apiGet<Analytics>(`/api/v1/admin/analytics${range()}`), [days]);
  return (
    <div>
      <PageHead title="Analytics" sub="Aggregates only, for the selected window. Maximum range is 366 days." />
      <div className="mb-6 flex gap-2">{[7, 30, 90].map((d) => <Btn key={d} variant={days === d ? "primary" : "ghost"} onClick={() => setDays(d)}>Last {d} days</Btn>)}</div>
      {loading ? <Loading label="Loading analytics…" /> : error ? <ErrorBox message={error} onRetry={retry} /> : data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-card p-5 card-hover"><p className="text-sm text-muted">New users in window</p><p className="mt-1 font-display text-3xl font-bold">{data.newUsers}</p></div>
          <div className="rounded-xl border border-line bg-card p-5 card-hover"><p className="text-sm font-semibold">Revenue (paid only)</p>{data.revenue.length === 0 ? <p className="mt-2 text-sm text-muted">No paid revenue in this window.</p> : <ul className="mt-2 space-y-1">{data.revenue.map((r) => <li key={r._id} className="text-sm"><span className="font-bold">{r._id} {r.total.toLocaleString()}</span> · {r.count} payments</li>)}</ul>}</div>
          <div className="rounded-xl border border-line bg-card p-5 card-hover sm:col-span-2"><p className="text-sm font-semibold">Purchases by status</p>{data.purchasesByStatus.length === 0 ? <p className="mt-2 text-sm text-muted">No purchases in this window.</p> : <ul className="mt-2 flex flex-wrap gap-2">{data.purchasesByStatus.map((s) => <li key={s._id} className="rounded-full bg-soft px-3 py-1 text-sm font-medium">{s._id}: {s.count}</li>)}</ul>}</div>
        </div>
      )}
    </div>
  );
}
