"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { apiPost, ApiError } from "@/lib/api";
import { checkEmail } from "@/lib/validation";
import { useRedirectIfSignedIn } from "@/lib/auth";
import { FormSkeleton } from "@/components/Skeleton";

export default function SignUpPage() {
  // Signed-in users cannot stay on this page — sent to their workspace.
  const { user, loading: authLoading } = useRedirectIfSignedIn();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    else if (form.name.trim().length < 2) errs.name = "Full name must be at least 2 characters.";
    const emailErr = checkEmail(form.email); if (emailErr) errs.email = emailErr;
    if (!form.password) errs.password = "Password is required.";
    else if (!form.password.trim()) errs.password = "Password cannot be only spaces.";
    else if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (form.password.length > 128) errs.password = "Password must be 128 characters or less.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerError("");
    try {
      await apiPost("/api/auth/sign-up/email", { name: form.name.trim(), email: form.email.trim(), password: form.password });
      setDone(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Sign-up failed. Please try again.");
    } finally { setBusy(false); }
  };

  // While the session is being checked — and once we know the visitor is
  // signed in (redirect in flight) — never render the form.
  if (authLoading || user) {
    return (
      <AuthCard title="Create your account" sub="Verify your email then pick your workspace — student or teacher, chosen once after you sign in.">
        <FormSkeleton fields={3} label="Checking your session…" />
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Check your email" sub="One more step before you can use LearnTest.">
        <Notice tone="blue">
          We sent a verification email to <strong>{form.email}</strong>. Open that link to verify your account, then sign in.
          Unverified accounts cannot open protected content.
        </Notice>
        <Btn href="/sign-in" className="mt-5 w-full">Go to sign in</Btn>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" sub="Verify your email then pick your workspace — student or teacher, chosen once after you sign in.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <Notice tone="red">{serverError}</Notice>}
        <Field label="Full name" error={errors.name}>
          <input className={inputCls} autoComplete="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((p) => ({ ...p, name: "" })); }} placeholder="Your name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className={inputCls} type="email" autoComplete="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((p) => ({ ...p, email: "" })); }} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors((p) => ({ ...p, password: "" })); }} placeholder="Create a password" />
        </Field>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? "Creating account…" : "Create account"}</Btn>
        <p className="text-center text-sm text-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-brandstrong">Sign in</Link></p>
      </form>
    </AuthCard>
  );
}
