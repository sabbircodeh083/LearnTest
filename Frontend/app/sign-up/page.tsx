"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { apiPost, ApiError } from "@/lib/api";

export default function SignUpPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
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
          <input className={inputCls} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className={inputCls} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create a password" />
        </Field>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? "Creating account…" : "Create account"}</Btn>
        <p className="text-center text-sm text-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-brandstrong">Sign in</Link></p>
      </form>
    </AuthCard>
  );
}
