"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Empty, FieldError, Loading, useToast, Btn } from "@/components/ui";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { apiDelete, apiPatch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Section = "general" | "account" | "security";
type AccountType = "bank" | "mobile";

const inputCls = "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 shadow-[0_1px_3px_rgba(16,24,40,0.10)] outline-none focus:border-line focus:shadow-[0_2px_8px_rgba(16,24,40,0.12)]";
const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6 card-hover";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[15px] font-medium">{children}</span>;
}

const BANKS = [
  "Islami Bank Bangladesh Limited (IBBL)", "Dutch-Bangla Bank PLC", "BRAC Bank PLC",
  "Eastern Bank PLC", "The City Bank PLC", "Pubali Bank PLC", "Sonali Bank PLC",
  "Janata Bank PLC", "Agrani Bank PLC", "Standard Chartered Bank", "HSBC Bangladesh", "Other",
];
const PROVIDERS = ["bKash", "Nagad", "Rocket"];

function DeleteAccountSection() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (confirmText !== "DELETE") {
      setError('Please type "DELETE" to confirm.');
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await apiDelete("/api/v1/me", { password });
      await signOut();
      toast("Account deleted.");
      router.replace("/");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not delete account.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-label="Delete account" className="mt-6">
      <button
        type="button"
        onClick={() => { setPassword(""); setConfirmText(""); setError(""); setOpen(true); }}
        className="block w-full rounded-xl border border-dashed border-danger p-4 text-left transition hover:bg-dangersoft"
      >
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[16px] font-bold text-danger">Delete Account</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Permanently delete your account and all your data. This cannot be undone.
            </span>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Delete Account">
          <button aria-label="Close" className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <h3 className="text-[17px] font-bold">Delete Account</h3>
                <p className="text-[13px] text-muted">This action cannot be undone.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {error && <p role="alert" className="mb-3 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Enter your password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Type <span className="font-mono text-danger">DELETE</span> to confirm</label>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-5">
              <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleDelete} disabled={deleting || password === "" || confirmText !== "DELETE"}>
                {deleting ? "Deleting…" : "Delete Account"}
              </Btn>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default function TeacherSettingsPage() {
  const { user, loading, refresh } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState<Section>("account");

  const p = user?.payout;
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [holderName, setHolderName] = useState<string | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [routingNumber, setRoutingNumber] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearErr = (k: string) => setFieldErrors((p) => (p[k] ? { ...p, [k]: "" } : p));

  if (!loading && user && accountType === null) {
    setAccountType((p?.accountType as AccountType) || "bank");
    setHolderName(p?.holderName ?? "");
    setBankName(p?.bankName ?? "");
    setAccountNumber(p?.accountNumber ?? "");
    setBranchName(p?.branchName ?? "");
    setRoutingNumber(p?.routingNumber ?? "");
    setProvider(p?.provider ?? "");
    setMobileNumber(p?.mobileNumber ?? "");
  }

  const type = accountType ?? "bank";
  const save = async () => {
    setError("");
    const errs: Record<string, string> = {};
    if (!(holderName ?? "").trim()) errs.holderName = "Account holder name is required.";
    const payout: Record<string, string> = { accountType: type, holderName: (holderName ?? "").trim() };
    if (type === "bank") {
      if (!bankName) errs.bankName = "Bank name is required — choose your bank.";
      if (!(accountNumber ?? "").trim()) errs.accountNumber = "Account number is required.";
      else if (!/^[0-9]{5,24}$/.test((accountNumber ?? "").trim())) errs.accountNumber = "Account number must be 5–24 digits (digits only).";
      if (!(branchName ?? "").trim()) errs.branchName = "Branch name is required.";
      if (routingNumber?.trim() && !/^[0-9]{3,12}$/.test(routingNumber.trim())) errs.routingNumber = "Routing number must be 3–12 digits (digits only).";
      payout.bankName = bankName ?? "";
      payout.accountNumber = (accountNumber ?? "").trim();
      payout.branchName = (branchName ?? "").trim();
      payout.routingNumber = (routingNumber ?? "").trim();
      payout.provider = "";
      payout.mobileNumber = "";
    } else {
      if (!provider) errs.provider = "Provider is required — choose a mobile banking provider.";
      if (!(mobileNumber ?? "").trim()) errs.mobileNumber = "Mobile number is required.";
      else if (!/^\+?[0-9]{6,15}$/.test((mobileNumber ?? "").trim())) errs.mobileNumber = "Enter a valid mobile number (6–15 digits, e.g. 01XXXXXXXXX).";
      payout.provider = provider ?? "";
      payout.mobileNumber = (mobileNumber ?? "").trim();
      payout.bankName = "";
      payout.accountNumber = "";
      payout.branchName = "";
      payout.routingNumber = "";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) { setError("Please fix the highlighted fields below."); return; }
    setSaving(true);
    try {
      await apiPatch("/api/v1/me", { payout });
      await refresh();
      toast("Payout account saved.");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save payout details.");
    } finally {
      setSaving(false);
    }
  };

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>) },
    { key: "account", label: "Account Details", icon: (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14" /></svg>) },
    { key: "security", label: "Password & Security", icon: (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>) },
  ];

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <h1 className="text-[26px] font-bold tracking-tight">Settings</h1>
      <p className="text-[15px] text-muted">Manage your account and payment information.</p>

      {loading || !user ? <div className="mt-6"><Loading label="Loading settings…" /></div>
        : (
          <div className="mt-4 grid items-start gap-5 lg:grid-cols-[220px_1fr]">
            {/* sub nav */}
            <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:sticky lg:top-20 lg:flex-col">
              {sections.map((s) => (
                <button key={s.key} onClick={() => setSection(s.key)} aria-current={section === s.key ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium ${section === s.key ? "bg-[#e8f1fe] font-semibold text-[#1d6ce0]" : "text-muted hover:bg-soft hover:text-ink"}`}>
                  {s.icon}{s.label}
                </button>
              ))}
            </nav>

            {section === "general" ? (
              <section className={cardCls} aria-label="General">
                <Empty title="General preferences coming soon" body="Notification and display preferences will live here." />
              </section>
            ) : section === "security" ? (
              <section className={cardCls} aria-label="Password and Security">
                <h2 className="text-xl font-bold tracking-tight">Password &amp; Security</h2>
                <p className="mt-0.5 text-sm text-muted">Update the password you use to sign in.</p>
    <div className="mt-4">
      <ChangePasswordCard />
      <DeleteAccountSection />
    </div>
              </section>
            ) : (
              <div className="grid items-start gap-5 xl:grid-cols-5">
                <div className="space-y-5 xl:col-span-3">
                  <section className={`${cardCls} !border-[#bfdbfe] !bg-[#f5f9ff] dark:!bg-soft`} aria-label="Payout Account">
                    <div className="flex items-center gap-4">
                      <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d6ce0]">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5" /><path d="M4 9.5V19M8.5 9.5V19M12 9.5V19M15.5 9.5V19M20 9.5V19" /><path d="M2.5 19.5h19" /></svg>
                      </span>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">Payout Account</h2>
                        <p className="mt-0.5 text-sm text-muted">Add your bank or mobile banking account to receive your earnings.</p>
                      </div>
                    </div>
                  </section>

                  <section className={cardCls} aria-label="Account details form">
                    <h3 className="text-[16px] font-bold">Account Type</h3>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account Type">
                      {(["bank", "mobile"] as const).map((k) => (
                        <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setAccountType(k)}
                          className={`rounded-xl border p-4 text-left ${type === k ? "border-[#1d6ce0] bg-[#f5f9ff] dark:bg-soft" : "border-line"}`}>
                          <span className="flex items-center gap-2 font-semibold">
                            <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${type === k ? "border-[#1d6ce0]" : "border-line"}`}>
                              {type === k && <span className="h-2.5 w-2.5 rounded-full bg-[#1d6ce0]" />}
                            </span>
                            {k === "bank" ? "Bank Account" : "Mobile Banking"}
                          </span>
                          <span className="mt-0.5 block pl-7 text-[13px] text-muted">
                            {k === "bank" ? "Receive payments to your bank account" : "Receive payments to bKash, Nagad, etc."}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4">
                      <Label>Account Holder Name</Label>
                      <input value={holderName ?? ""} onChange={(e) => { setHolderName(e.target.value); clearErr("holderName"); }} maxLength={120}
                        placeholder="Md Sabbir Sikder" className={inputCls} />
                        <FieldError>{fieldErrors.holderName}</FieldError>
                    </div>

                    {type === "bank" ? (
                      <>
                        <div className="mt-4">
                          <Label>Bank Name</Label>
                          <select value={bankName ?? ""} onChange={(e) => { setBankName(e.target.value); clearErr("bankName"); }} className={inputCls}>
                            <option value="">Select your bank…</option>
                            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <FieldError>{fieldErrors.bankName}</FieldError>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label>Account Number</Label>
                            <input value={accountNumber ?? ""} onChange={(e) => { setAccountNumber(e.target.value); clearErr("accountNumber"); }} inputMode="numeric" maxLength={32}
                              placeholder="20501234567890" className={inputCls} />
                              <FieldError>{fieldErrors.accountNumber}</FieldError>
                          </div>
                          <div>
                            <Label>Branch Name</Label>
                            <input value={branchName ?? ""} onChange={(e) => { setBranchName(e.target.value); clearErr("branchName"); }} maxLength={160}
                              placeholder="Dhanmondi Branch" className={inputCls} />
                              <FieldError>{fieldErrors.branchName}</FieldError>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Label>Routing Number (Optional)</Label>
                          <input value={routingNumber ?? ""} onChange={(e) => { setRoutingNumber(e.target.value); clearErr("routingNumber"); }} inputMode="numeric" maxLength={32}
                            placeholder="e.g. 125263436" className={inputCls} />
                          <FieldError>{fieldErrors.routingNumber}</FieldError>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Provider</Label>
                          <select value={provider ?? ""} onChange={(e) => { setProvider(e.target.value); clearErr("provider"); }} className={inputCls}>
                            <option value="">Select provider…</option>
                            {PROVIDERS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <FieldError>{fieldErrors.provider}</FieldError>
                        </div>
                        <div>
                          <Label>Mobile Number</Label>
                          <input value={mobileNumber ?? ""} onChange={(e) => { setMobileNumber(e.target.value); clearErr("mobileNumber"); }} inputMode="tel" maxLength={20}
                            placeholder="01XXXXXXXXX" className={inputCls} />
                              <FieldError>{fieldErrors.mobileNumber}</FieldError>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 rounded-xl bg-[#f5f9ff] p-4 dark:bg-soft" aria-label="Important Information">
                      <p className="flex items-center gap-2 font-bold">
                        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1d6ce0] text-xs text-white">i</span>
                        Important Information
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-muted">
                        <li>The account details will be used to send your earnings from LearnTest.</li>
                        <li>Make sure the account is in your own name.</li>
                        <li>Keep your information accurate to avoid payment issues.</li>
                        <li>You can update this information anytime.</li>
                      </ul>
                    </div>

                    {error && <p role="alert" className="mt-3 rounded-lg bg-dangersoft px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}

                    <button type="button" onClick={() => void save()} disabled={saving}
                      className="mt-4 rounded-xl bg-[#1d6ce0] px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                      {saving ? "Saving…" : "Save Account Details"}
                    </button>
                  </section>
                </div>

                {/* right rail */}
                <aside className="space-y-5 xl:sticky xl:top-20 xl:col-span-2">
                  <section className={cardCls} aria-label="Payout Information">
                    <div className="flex items-start gap-4">
                      <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M14.5 9.5c-.6-1-1.5-1.3-2.5-1.3-1.4 0-2.5.8-2.5 2 0 2.7 5.5 1.3 5.5 4 0 1.2-1.1 2-2.5 2-1 0-1.9-.4-2.5-1.3" /></svg>
                      </span>
                      <div>
                        <h2 className="text-[17px] font-bold">Payout Information</h2>
                        <p className="mt-1 text-sm text-muted">Your earnings from paid tests and other content will be sent to this account.</p>
                      </div>
                    </div>
                  </section>

                  <section className={cardCls} aria-label="Supported Payment Methods">
                    <h2 className="text-[17px] font-bold">Supported Payment Methods</h2>
                    <div className="mt-3 flex items-center gap-4 border-b border-line pb-4">
                      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d6ce0]">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5" /><path d="M4 9.5V19M8.5 9.5V19M12 9.5V19M15.5 9.5V19M20 9.5V19" /><path d="M2.5 19.5h19" /></svg>
                      </span>
                      <div>
                        <p className="font-bold">Bank Transfer</p>
                        <p className="text-sm text-muted">Direct transfer to your bank account</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fce7f3] text-[#db2777]">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>
                      </span>
                      <div>
                        <p className="font-bold">Mobile Banking</p>
                        <p className="text-sm text-muted">bKash, Nagad (coming soon)</p>
                      </div>
                    </div>
                  </section>

                  <section className={cardCls} aria-label="Security and Privacy">
                    <div className="flex items-center gap-4">
                      <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="m9.5 12 1.8 1.8 3.2-3.6" /></svg>
                      </span>
                      <h2 className="text-[17px] font-bold">Security & Privacy</h2>
                    </div>
                    <ul className="mt-3 space-y-2.5 text-sm text-muted">
                      {["Your account details are securely stored.", "Only you can view and edit this information.", "We do not share your banking details with any third party."].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                          </span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                </aside>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
