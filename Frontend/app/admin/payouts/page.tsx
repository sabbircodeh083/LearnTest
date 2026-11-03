"use client";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, inputCls, Loading, PageHead, useToast } from "@/components/ui";
import { apiGet, apiPost, ApiError, qs } from "@/lib/api";
import { ModalShell } from "@/components/AlertDialog";
import { useFetch } from "@/lib/hooks";
import { fmtDate, fmtMoney } from "@/lib/types";

interface TeacherPayoutAccount {
  accountType: string;
  holderName: string;
  bankName: string;
  accountNumber: string;
  branchName: string;
  routingNumber: string;
  provider: string;
  mobileNumber: string;
}
interface TeacherPayout {
  teacherId: string;
  name: string;
  email: string;
  totalEarned: number;
  salesCount: number;
  totalPaidOut: number;
  duePayout: number;
  currency: string;
  payout?: TeacherPayoutAccount | null;
}
interface PayoutHistoryItem { id: string; amount: number; currency: string; note: string; createdBy: string; createdAt: string | null }
interface PayoutDetail { teacher: TeacherPayout; history: PayoutHistoryItem[] }

function maskAccount(value: string) {
  const t = (value ?? "").trim();
  if (!t) return "—";
  if (t.length <= 4) return "****";
  return `**** **** ${t.slice(-4)}`;
}

function PayoutAccount({ payout }: { payout?: TeacherPayoutAccount | null }) {
  const [reveal, setReveal] = useState(false);
  if (!payout?.accountType) {
    return <p className="mt-3 rounded-lg bg-soft px-3 py-2 text-[13px] text-muted">No payout account added by this teacher yet.</p>;
  }
  const secret = payout.accountType === "bank" ? payout.accountNumber : payout.mobileNumber;
  return (
    <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
      <div className="flex items-start justify-between gap-3">
        <dt className="text-muted">Payout via</dt>
        <dd className="text-right font-semibold">
          {payout.accountType === "bank" ? "Bank Account" : `Mobile Banking${payout.provider ? ` • ${payout.provider}` : ""}`}
        </dd>
      </div>
      {!!payout.holderName && (
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Account Holder</dt>
          <dd className="text-right font-semibold">{payout.holderName}</dd>
        </div>
      )}
      {payout.accountType === "bank" ? (
        <>
          {!!payout.bankName && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Bank Name</dt>
              <dd className="max-w-[200px] text-right font-semibold">{payout.bankName}</dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted">Account Number</dt>
            <dd className="flex items-center justify-end gap-1.5 font-semibold">
              <span className="font-mono text-xs">{reveal ? secret || "—" : maskAccount(secret)}</span>
              {!!secret && (
                <button type="button" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide account number" : "Show account number"}
                  className="rounded p-1 text-muted hover:bg-soft hover:text-ink">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              )}
            </dd>
          </div>
          {!!payout.branchName && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Branch</dt>
              <dd className="text-right font-semibold">{payout.branchName}</dd>
            </div>
          )}
          {!!payout.routingNumber && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Routing No.</dt>
              <dd className="font-mono text-xs font-semibold">{payout.routingNumber}</dd>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Mobile Number</dt>
          <dd className="font-mono text-xs font-semibold">{reveal ? secret || "—" : maskAccount(secret)}</dd>
        </div>
      )}
    </dl>
  );
}

function initialsOf(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

function ManageModal({ teacher, onClose, onDone }: { teacher: TeacherPayout; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data, error, loading, retry } = useFetch(
    () => apiGet<PayoutDetail>(`/api/v1/admin/payouts/${teacher.teacherId}`), [teacher.teacherId]);
  const t = data?.teacher ?? teacher;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const record = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast("Enter a payout amount above 0.", "err"); return; }
    if (amt > t.duePayout) { toast(`Amount exceeds due payout (${fmtMoney(t.duePayout, t.currency)}).`, "err"); return; }
    setBusy(true);
    try {
      await apiPost(`/api/v1/admin/payouts/${t.teacherId}`, { amount: amt, note: note.trim() });
      toast(`Payout of ${fmtMoney(amt, t.currency)} recorded for ${t.email}.`);
      setAmount(""); setNote("");
      retry(); onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not record payout.", "err");
    } finally { setBusy(false); }
  };

  return (
    <ModalShell label={`Manage payout for ${t.email}`} onClose={onClose} maxWidth="max-w-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Manage Payout</h2>
            <p className="mt-0.5 text-sm text-muted">{t.name || t.email}</p>
            <p className="break-all text-xs text-muted">{t.email}</p>
            <p className="break-all font-mono text-xs text-muted">Teacher ID: {t.teacherId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-soft">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-soft p-3">
            <p className="text-xs text-muted">Total Earned</p>
            <p className="mt-1 font-bold">{fmtMoney(t.totalEarned, t.currency)}</p>
          </div>
          <div className="rounded-xl bg-soft p-3">
            <p className="text-xs text-muted">Paid Out</p>
            <p className="mt-1 font-bold">{fmtMoney(t.totalPaidOut, t.currency)}</p>
          </div>
          <div className="rounded-xl bg-[#e6f9ec] p-3 dark:bg-brandsoft">
            <p className="text-xs text-muted">Due Payout</p>
            <p className="mt-1 font-bold text-[#16a34a]">{fmtMoney(t.duePayout, t.currency)}</p>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-bold">Payout account</h3>
          <PayoutAccount payout={t.payout} />
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-bold">Record a manual payout</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Amount (USD) <span aria-hidden className="text-danger">*</span></span>
              <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={t.duePayout > 0 ? `Up to ${t.duePayout}` : "Nothing due"} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                placeholder="e.g. bKash payment, Nov" className={inputCls} />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Btn onClick={record} disabled={busy || t.duePayout <= 0}>{busy ? "Recording…" : "Record Payout"}</Btn>
            {t.duePayout > 0 && (
              <Btn variant="ghost" onClick={() => setAmount(String(t.duePayout))} disabled={busy}>Pay full due</Btn>
            )}
            {t.duePayout <= 0 && <p className="text-sm text-muted">Nothing is due — all earnings are paid out.</p>}
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-bold">Payout history</h3>
          {loading ? <div className="mt-2"><Loading label="Loading history…" /></div>
            : error ? <div className="mt-2"><ErrorBox message={error} onRetry={retry} /></div>
            : !(data?.history.length) ? <p className="mt-2 text-sm text-muted">No payouts recorded yet.</p>
            : (
              <ul className="mt-2 divide-y divide-line">
                {data!.history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">{fmtMoney(h.amount, h.currency)}</span>
                      {h.note && <span className="block text-xs text-muted">{h.note}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
    </ModalShell>
  );
}

function PayoutCard({ t, onManage }: { t: TeacherPayout; onManage: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f1fe] text-[15px] font-bold text-[#1d6ce0]">
          {initialsOf(t.name, t.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{t.name || "—"}</p>
          <p className="truncate text-[13px] text-muted">{t.email}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted">ID: {t.teacherId}</p>
        </div>
        {t.duePayout > 0
          ? <Badge tone="amber">Due</Badge>
          : <Badge tone="green">Settled</Badge>}
      </div>
      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Total earned</dt>
          <dd className="font-semibold">{fmtMoney(t.totalEarned, t.currency)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Paid out</dt>
          <dd className="font-semibold">{fmtMoney(t.totalPaidOut, t.currency)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Due payout</dt>
          <dd className={`font-bold ${t.duePayout > 0 ? "text-[#16a34a]" : "text-muted"}`}>{fmtMoney(t.duePayout, t.currency)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Paid sales</dt>
          <dd className="font-semibold">{t.salesCount}</dd>
        </div>
      </dl>
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
        aria-label={expanded ? "Collapse payout details" : "Expand payout details"}
        className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-[#1d6ce0] hover:bg-soft">
        <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <>
          <PayoutAccount payout={t.payout} />
          <button type="button" onClick={onManage}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">
            Manage Payout
          </button>
        </>
      )}
    </article>
  );
}

export default function AdminPayoutsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TeacherPayout | null>(null);
  const { data, error, loading, retry } = useFetch(() => apiGet<{ items: TeacherPayout[]; total: number }>("/api/v1/admin/payouts"), []);
  const q = search.trim().toLowerCase();
  const items = (data?.items ?? []).filter((t) =>
    !q || t.email.toLowerCase().includes(q) || t.teacherId.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));

  return (
    <div>
      <PageHead title="Payout" sub="What each teacher has earned from paid sales, what has been paid out, and what is still due. Record manual payouts from each teacher's card." />
      <div className="mb-5 max-w-md">
        <label className="sr-only" htmlFor="admin-payout-search">Search teachers</label>
        <input id="admin-payout-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or teacher ID…" className={inputCls} />
      </div>

      {loading ? <Loading label="Loading teacher payouts…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !items.length ? <Empty title="No teachers found" body={q ? "No teacher matches this search." : "Teachers will appear here once they register."} /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => (
              <PayoutCard key={t.teacherId} t={t} onManage={() => setSelected(t)} />
            ))}
          </div>
        )}
      {selected && <ManageModal teacher={selected} onClose={() => setSelected(null)} onDone={retry} />}
    </div>
  );
}
