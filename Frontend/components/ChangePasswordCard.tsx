"use client";
import { useCallback, useId, useState } from "react";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { checkPassword, passwordChecks } from "@/lib/password";

type Account = { providerId?: string };
type AccountsState = "idle" | "loading" | "ready" | "error";

const providerLabel = (provider: string) => {
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return provider;
};

/**
 * Collapsible change-password card for a signed-in student or teacher.
 *
 * Email/password accounts use Better Auth's POST /change-password with the
 * current password. OAuth-only accounts (Google/GitHub) have no password, so
 * they get a clear notice instead of a form that cannot work.
 *
 * The account check is lazy: it runs only when the card is first opened.
 */
export function ChangePasswordCard() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [accountsState, setAccountsState] = useState<AccountsState>("idle");
  const [hasPassword, setHasPassword] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    setAccountsState("loading");
    setServerError("");
    try {
      const accounts = await apiGet<Account[]>("/api/auth/list-accounts");
      const ids = accounts.map((a) => String(a.providerId ?? "")).filter(Boolean);
      setProviders(ids);
      setHasPassword(ids.includes("credential"));
      setAccountsState("ready");
    } catch (err) {
      setAccountsState("error");
      setServerError(err instanceof ApiError ? err.message : "Could not check your sign-in method.");
    }
  }, []);

  const toggleOpen = () => {
    if (open) {
      // Do not keep entered passwords (or the show state) around while hidden.
      setOpen(false);
      setForm({ current: "", next: "", confirm: "" });
      setErrors({});
      setServerError("");
      setShow(false);
      return;
    }
    setOpen(true);
    if (accountsState === "idle") void loadAccounts();
  };

  const checks = passwordChecks(form.next);

  const clearError = (key: string) => {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
    setServerError("");
    setSuccess("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.current) errs.current = "Enter your current password.";
    const nextErr = checkPassword(form.next);
    if (nextErr) errs.next = nextErr;
    else if (form.next === form.current) errs.next = "New password must be different from your current password.";
    if (!form.confirm) errs.confirm = "Confirm your new password.";
    else if (form.confirm !== form.next) errs.confirm = "Passwords do not match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setServerError("");
    setSuccess("");
    try {
      await apiPost("/api/auth/change-password", {
        currentPassword: form.current,
        newPassword: form.next,
        revokeOtherSessions: true,
      });
      setForm({ current: "", next: "", confirm: "" });
      setErrors({});
      setSuccess("Password updated. Other sessions have been signed out.");
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setServerError("Could not update your password. Please try again.");
      } else if (err.code === "INVALID_PASSWORD") {
        setErrors({ current: "Your current password is incorrect." });
      } else if (err.code === "WEAK_PASSWORD") {
        setErrors({ next: err.message });
      } else if (err.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
        setProviders((prev) => prev.filter((p) => p !== "credential"));
        setHasPassword(false);
      } else if (err.status === 429) {
        setServerError("Too many attempts. Please wait a minute and try again.");
      } else if (err.status === 401) {
        setServerError("Your session expired. Please sign in again.");
      } else {
        setServerError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const renderPanel = () => {
    if (accountsState === "idle" || accountsState === "loading") {
      return <p className="text-sm text-muted">Checking your sign-in method…</p>;
    }

    if (accountsState === "error") {
      return (
        <div>
          <p className="text-sm font-medium text-danger">{serverError || "Could not check your sign-in method."}</p>
          <Btn variant="ghost" className="mt-2 bg-card" onClick={() => void loadAccounts()}>Retry</Btn>
        </div>
      );
    }

    if (!hasPassword) {
      const social = providers.filter((p) => p !== "credential").map(providerLabel);
      const label = social.length ? social.join(" or ") : "a social provider";
      return (
        <div>
          <p className="text-sm font-bold">Password not available</p>
          <p className="mt-1 text-[13px] text-muted">
            You sign in with {label}. This account has no password to change — continue using {label} to sign in.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-pressed={show}
            onClick={() => setShow((s) => !s)}
            className="text-xs font-semibold text-brandstrong"
          >
            {show ? "Hide passwords" : "Show passwords"}
          </button>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          {success && <Notice tone="blue">{success}</Notice>}
          {serverError && <Notice tone="red">{serverError}</Notice>}

          <Field label="Current password" error={errors.current}>
            <input
              className={inputCls}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => { setForm({ ...form, current: e.target.value }); clearError("current"); }}
              placeholder="Your current password"
            />
          </Field>

          <Field
            label="New password"
            error={errors.next}
            hint="At least 12 characters with 1 uppercase, 1 lowercase and 1 symbol."
          >
            <input
              className={inputCls}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={form.next}
              onChange={(e) => { setForm({ ...form, next: e.target.value }); clearError("next"); }}
              placeholder="Create a new password"
            />
          </Field>
          {form.next && <PasswordChecklist checks={checks} />}

          <Field label="Confirm new password" error={errors.confirm}>
            <input
              className={inputCls}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => { setForm({ ...form, confirm: e.target.value }); clearError("confirm"); }}
              placeholder="Repeat the new password"
            />
          </Field>

          <div className="flex justify-end">
            <Btn type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Btn>
          </div>
        </form>
      </>
    );
  };

  return (
    <div
      className="rounded-xl border border-line card-hover"
      onKeyDown={(e) => { if (e.key === "Escape" && open) toggleOpen(); }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span>
          <span className="block text-sm font-bold">Change password</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {success ? "Password updated." : "Update the password you use to sign in."}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="border-t border-line p-4 sm:p-5">
          {renderPanel()}
        </div>
      )}
    </div>
  );
}
