"use client";
import Link from "next/link";
import { ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { AdminOverview } from "@/lib/types";

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </>
  );
  return href
    ? <Link href={href} className="rounded-xl border border-line bg-card p-5 hover:border-brand">{inner}</Link>
    : <div className="rounded-xl border border-line bg-card p-5">{inner}</div>;
}

export default function AdminOverviewPage() {
  const { data, error, loading, retry } = useFetch(() => apiGet<AdminOverview>("/api/v1/admin/overview"), []);
  return (
    <div>
      <PageHead title="Admin overview" sub="Platform totals exactly as returned by the server. If you can see this, your verified admin session is active." />
      {loading ? <Loading label="Loading overview…" /> : error ? <ErrorBox message={error} onRetry={retry} /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Pending payout" value={data.pendingPayouts ?? 0} href="/admin/payouts" />
            <Stat label="Paid Payment" value={data.payments.paid} href="/admin/payments" />
            <Stat label="Total users" value={data.users} href="/admin/users" />
            <Stat label="Students" value={data.students} href="/admin/users?role=student" />
            <Stat label="Teachers" value={data.teachers} href="/admin/users?role=teacher" />
          </div>
          <p className="mt-6 text-sm text-muted">
            Manage people in <Link href="/admin/users" className="font-semibold text-brandstrong">Users</Link>, review money in{" "}
            <Link href="/admin/payments" className="font-semibold text-brandstrong">Payments</Link>, and moderate flagged content in{" "}
            <Link href="/admin/reports" className="font-semibold text-brandstrong">Reports</Link>.
          </p>
        </>
      )}
    </div>
  );
}
