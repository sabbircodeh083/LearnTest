"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { FormSkeleton } from "@/components/Skeleton";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { apiPost, ApiError } from "@/lib/api";
import { checkPassword, passwordChecks } from "@/lib/password";

function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const linkError = search.get("error");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || linkError === "INVALID_TOKEN";
  const checks = passwordChecks(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidLink) return;
    const errs: Record<string, string> = {};
    const passwordErr = checkPassword(form.password);
    if (passwordErr) errs.password = passwordErr;
    if (!form.confirm) errs.confirm = "Please confirm your new password.";
    else if (form.confirm !== form.password) errs.confirm = "Passwords do not match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setServerError("");
    try {
      await apiPost("/api/auth/reset-password", { newPassword: form.password, token });
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not reset your password. Please try again.";
      if (/token|expired|invalid/i.test(message)) {
        setServerError("This reset link is invalid or has expired. Request a new link from the sign-in page.");
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError("Too many attempts. Please wait a minute and try again.");
      } else {
        setServerError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard title="Password updated" sub="Your new password is ready to use.">
        <Notice tone="blue">For your security, all existing sessions have been signed out.</Notice>
        <Btn href="/sign-in?reset=1" className="mt-5 w-full">Go to sign in</Btn>
      </AuthCard>
    );
  }

  if (invalidLink) {
    return (
      <AuthCard title="Reset link expired" sub="This password-reset link is no longer valid.">
        <Notice tone="red">
          Reset links expire after one hour and can only be used once. Request a fresh link from the sign-in page.
        </Notice>
        <Btn href="/sign-in" className="mt-5 w-full">Request a new link</Btn>
        <p className="mt-4 text-center text-sm text-muted">
          Remembered your password? <Link href="/sign-in" className="font-semibold text-brandstrong">Sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" sub="Use a strong password you have not used before.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <Notice tone="red">{serverError}</Notice>}
        <Field label="New password" error={errors.password} hint="At least 12 characters with 1 uppercase, 1 lowercase and 1 symbol.">
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors((p) => ({ ...p, password: "" })); }}
            placeholder="Create a new password"
          />
        </Field>
        {form.password && <PasswordChecklist checks={checks} />}
        <Field label="Confirm new password" error={errors.confirm}>
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setErrors((p) => ({ ...p, confirm: "" })); }}
            placeholder="Repeat the new password"
          />
        </Field>
        <Btn type="submit" disabled={busy || !checks.valid} className="w-full">
          {busy ? "Updating password…" : "Update password"}
        </Btn>
        <p className="text-center text-sm text-muted">
          <Link href="/sign-in" className="font-semibold text-brandstrong">Back to sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Choose a new password" sub="Use a strong password you have not used before.">
          <FormSkeleton fields={2} label="Loading reset form…" />
        </AuthCard>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
