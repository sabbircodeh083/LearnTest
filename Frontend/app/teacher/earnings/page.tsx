"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, Loading, statusTone } from "@/components/ui";
import { DataList, DataRow, RowChip, RowIcon } from "@/components/DataList";
import { apiGet, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Page } from "@/lib/types";

interface TeacherSale {
  purchaseId: string;
  tranId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string | null;
  student: { userId: string; name: string; email: string };
  content: { contentType: string; contentId: string; title: string };
}

interface PayoutHistoryItem {
  id: string;
  amount: number;
  currency: string;
  note: string;
  createdBy: string;
  createdAt: string | null;
}

interface MyPayout {
  totalEarned: number;
  totalPaidOut: number;
  duePayout: number;
  currency: string;
  salesCount: number;
  history: PayoutHistoryItem[];
}

const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6";

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      {icon}
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-[24px] font-bold leading-none tracking-tight">$ {value}</p>
        <p className="mt-1.5 text-[13px] text-muted">{sub}</p>
      </div>
    </div>
  );
}

function mask(value: string) {
  const t = value.trim();
  if (t.length <= 4) return "****";
  return `**** **** ${t.slice(-4)}`;
}

export default function TeacherEarningsPage() {
  const { user } = useAuth();
  const [reveal, setReveal] = useState(false);

  const payout = useFetch(() => apiGet<MyPayout>("/api/v1/purchases/payouts/me"), []);
  const [salesPage, setSalesPage] = useState(1);
  const salesLimit = 15;
  const sales = useFetch(
    () => apiGet<Page<TeacherSale>>(`/api/v1/purchases/sales/me${qs({ page: salesPage, limit: salesLimit })}`), [salesPage]);
  const salesPages = Math.max(1, Math.ceil((sales.data?.total ?? 0) / salesLimit));

  const loading = payout.loading;
  const error = payout.error;

  const totalEarned = payout.data?.totalEarned ?? 0;
  const totalPaidOut = payout.data?.totalPaidOut ?? 0;
  const duePayout = payout.data?.duePayout ?? 0;
  const history = payout.data?.history ?? [];

  const account = user?.payout;
  const hasPayout = Boolean(account?.accountType);
  const payoutAccount = account?.accountType === "bank" ? account.accountNumber : account?.mobileNumber ?? "";

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Earnings</h1>
          <p className="text-[15px] text-muted">Track what you earned, what the admin has paid out, and what is still due.</p>
        </div>
      </div>

      {loading ? <div className="mt-6"><Loading label="Loading earnings…" /></div>
        : error ? <div className="mt-6"><ErrorBox message={error} onRetry={() => payout.retry()} /></div>
        : (
          <>
            {/* stat cards */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <StatCard label="Total Earnings" value={totalEarned.toLocaleString()} sub={`${payout.data?.salesCount ?? 0} paid sales`}
                icon={<span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 8h10l1.5 12.5a1 1 0 0 1-1 1.1H6.5a1 1 0 0 1-1-1.1z" /><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" /><circle cx="12" cy="15" r="1.6" /><path d="M12 13.8v2.4l1.7-1z" /></svg></span>} />
              <StatCard label="Get Payout" value={totalPaidOut.toLocaleString()} sub="Total received from admin"
                icon={<span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fe] text-[#1d6ce0]"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></svg></span>} />
              <StatCard label="Due Payout" value={duePayout.toLocaleString()} sub="Still left to be paid by admin"
                icon={<span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#fef3e2] text-[#d97706]"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg></span>} />
            </div>

            <div className="mt-4 grid items-start gap-4 xl:grid-cols-5">
              {/* get payout details — payments received from admin (first) */}
              <section className={`${cardCls} xl:col-span-3`} aria-label="Get Payout Details">
                <div>
                  <h2 className="text-[17px] font-bold">Get Payout Details</h2>
                  <p className="text-[13px] text-muted">Every payment you received from the admin, recorded against your earnings.</p>
                </div>
                <div className="mt-3">
                  {!history.length ? <Empty title="No payouts yet" body="When the admin pays you, the payment will be recorded here with the amount, note and date." />
                    : (
                      <DataList label="Payout history">
                        {history.map((h) => (
                          <DataRow
                            key={h.id}
                            icon={
                              <RowIcon tone="bg-[#e8f1fe] text-[#1d6ce0]">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>
                              </RowIcon>
                            }
                            title={`$ ${Number(h.amount ?? 0).toLocaleString()}`}
                            meta={fmtDate(h.createdAt ?? "")}
                            detail={[h.note || null, h.createdBy ? `Recorded by ${h.createdBy}` : null].filter(Boolean).join(" · ") || "—"}
                          />
                        ))}
                      </DataList>
                    )}
                </div>
              </section>

              {/* payout account */}
              <section className={`${cardCls} xl:col-span-2`} aria-label="Payout Account">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-bold">Payout Account</h2>
                  <Link href="/teacher/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                    Edit
                  </Link>
                </div>
                {!hasPayout ? (
                  <div className="mt-3"><Empty title="No payout account" body="Add a bank or mobile banking account in Settings to receive your earnings."
                    action={<Link href="/teacher/settings" className="inline-flex rounded-lg bg-[#1d6ce0] px-4 py-2 text-sm font-semibold text-white">Open Settings</Link>} /></div>
                ) : (
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d6ce0]">
                        {account?.accountType === "mobile"
                          ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>
                          : <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5" /><path d="M4 9.5V19M8.5 9.5V19M12 9.5V19M15.5 9.5V19M20 9.5V19" /><path d="M2.5 19.5h19" /></svg>}
                      </span>
                      <p className="font-bold">{account?.accountType === "mobile" ? `Mobile Banking${account.provider ? ` • ${account.provider}` : ""}` : "Bank Account"}</p>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Account Holder Name</dt>
                        <dd className="text-right font-semibold">{account?.holderName || "—"}</dd>
                      </div>
                      {account?.accountType === "bank" ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted">Bank Name</dt>
                            <dd className="max-w-[220px] text-right font-semibold">{account?.bankName || "—"}</dd>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted">Account Number</dt>
                            <dd className="flex items-center gap-2 font-semibold">
                              {reveal ? payoutAccount || "—" : mask(payoutAccount)}
                              {!!payoutAccount && (
                                <button type="button" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide account number" : "Show account number"}
                                  className="rounded p-1 text-muted hover:bg-soft hover:text-ink">
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                                </button>
                              )}
                            </dd>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted">Branch Name</dt>
                            <dd className="text-right font-semibold">{account?.branchName || "—"}</dd>
                          </div>
                          {!!account?.routingNumber && (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-muted">Routing Number</dt>
                              <dd className="font-semibold">{account.routingNumber}</dd>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted">Mobile Number</dt>
                          <dd className="font-semibold">{reveal ? account?.mobileNumber || "—" : mask(account?.mobileNumber ?? "")}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </section>
            </div>

            {/* payment details — real sales of this teacher's content (bottom) */}
            <section className={`${cardCls} mt-4`} aria-label="Payment Details">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-bold">Payment Details</h2>
                  <p className="text-[13px] text-muted">Every purchase of your videos and tests, with the student, transaction and content.</p>
                </div>
              </div>
              <div className="mt-3">
                {sales.loading ? <Loading label="Loading payments…" />
                  : sales.error ? <ErrorBox message={sales.error} onRetry={sales.retry} />
                  : !sales.data?.items.length ? <Empty title="No sales yet" body="When a student buys your video or test, the payment will appear here with the student, transaction and content details." />
                  : (
                    <>
                      <DataList label="Sales">
                        {sales.data.items.map((s) => (
                          <DataRow
                            key={s.purchaseId}
                            icon={
                              <RowIcon tone="bg-[#e6f9ec] text-[#16a34a]">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                              </RowIcon>
                            }
                            title={s.student.name || s.student.email || "—"}
                            meta={<>$ {Number(s.amount ?? 0).toLocaleString()} · <Badge tone={statusTone(s.status)}>{s.status}</Badge></>}
                            detail={<span className="break-all">{s.content.title || "—"} ({s.content.contentType}) · {s.tranId}</span>}
                            chip={<RowChip tone="bg-soft text-muted">{s.content.contentType}</RowChip>}
                          />
                        ))}
                      </DataList>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Btn variant="ghost" disabled={salesPage <= 1} onClick={() => setSalesPage((p) => p - 1)}>Previous</Btn>
                        <span className="text-sm text-muted">Page {salesPage} of {salesPages} · {sales.data.total} payments</span>
                        <Btn variant="ghost" disabled={salesPage >= salesPages} onClick={() => setSalesPage((p) => p + 1)}>Next</Btn>
                      </div>
                      <p className="mt-2 text-xs text-muted">Only purchases of content you own are listed. Amounts were charged by the payment gateway in {sales.data.items[0]?.currency ?? "USD"}.</p>
                    </>
                  )}
              </div>
            </section>
          </>
        )}
    </div>
  );
}
