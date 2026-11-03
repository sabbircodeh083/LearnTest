"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { FormSkeleton } from "@/components/Skeleton";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { apiPost, ApiError, API_BASE } from "@/lib/api";
import { useAuth, roleHome, useRedirectIfSignedIn } from "@/lib/auth";
import { safeExternalUrl, safeReturnTo } from "@/lib/url";
import { checkEmail } from "@/lib/validation";

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const rawReturn = search.get("returnTo");
  const returnTo = safeReturnTo(rawReturn) || null;
  const { refresh } = useAuth();
  // Signed-in users cannot stay on this page — sent to their workspace.
  const { user, loading: authLoading } = useRedirectIfSignedIn(returnTo);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const emailErr = checkEmail(form.email); if (emailErr) errs.email = emailErr;
    if (!form.password) errs.password = "Password is required.";
    else if (!form.password.trim()) errs.password = "Password cannot be only spaces — enter your password.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerError("");
    try {
      // No role is ever sent at sign-in; role comes from GET /api/v1/me.
      await apiPost("/api/auth/sign-in/email", { email: form.email.trim(), password: form.password });
      const me = await refresh();
      if (!me) { setServerError("Signed in, but we could not load your profile. Is the API running?"); return; }
      if (returnTo) router.replace(returnTo);
      else if (!me.roleSelected && me.role !== "admin") router.replace("/select-role");
      else router.replace(roleHome(me.role));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Sign-in failed.";
      setUnverified(msg.toLowerCase().includes("verif"));
      setServerError(msg.toLowerCase().includes("verif") ? "Your email is not verified yet. Open the verification link we emailed you, then sign in again." : msg);
    } finally { setBusy(false); }
  };

  const resend = async () => {
    if (checkEmail(form.email)) { setErrors({ email: "Enter a valid email first, then resend the link." }); return; }
    setResending(true); setResent(false);
    try {
      await apiPost("/api/auth/send-verification-email", {
        email: form.email.trim(),
        callbackURL: `${window.location.origin}/sign-in`,
      });
      setResent(true); setCooldown(60);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not resend. Try again in a minute.");
    } finally { setResending(false); }
  };

  const forgot = async () => {
    if (checkEmail(form.email)) { setErrors({ email: "Enter a valid email first, then choose Forgot password." }); return; }
    try {
      await apiPost("/api/auth/forget-password", { email: form.email.trim(), redirectTo: `${window.location.origin}/sign-in` });
      setResetSent(true);
    } catch { setResetSent(true); /* do not reveal whether the email exists */ }
  };

  const social = async (provider: "google" | "github") => {
    try {
      const data = await apiPost<{ url?: string }>("/api/auth/sign-in/social", {
        provider, callbackURL: `${window.location.origin}/select-role`,
      });
      if (data?.url && safeExternalUrl(data.url)) window.location.href = data.url;
      else window.location.href = `${API_BASE}/api/auth/sign-in/${provider}`;
    } catch {
      window.location.href = `${API_BASE}/api/auth/sign-in/${provider}`;
    }
  };

  // While the session is being checked — and once we know the visitor is
  // signed in (redirect in flight) — never render the form.
  if (authLoading || user) {
    return (
      <AuthCard title="Welcome back" sub="Sign in with the email you registered with.">
        <FormSkeleton fields={2} label="Checking your session…" />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Welcome back" sub="Sign in with the email you registered with.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <Notice tone="red">{serverError}</Notice>}
        {unverified && (
          <div className="rounded-xl border border-line bg-soft p-4 text-sm">
            <p className="font-semibold">Didn&apos;t get the email?</p>
            <p className="mt-0.5 text-muted">We can send the verification link again{form.email.trim() ? ` to ${form.email.trim()}` : ""}.</p>
            <Btn variant="ghost" className="mt-2 bg-card" onClick={resend} disabled={resending || cooldown > 0}>
              {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </Btn>
            {resent && <p className="mt-2 font-medium text-[#16a34a]">Sent — check your inbox and spam folder.</p>}
          </div>
        )}
        {resetSent && <Notice tone="blue">If that email has an account, a password-reset link is on its way.</Notice>}
        <Field label="Email" error={errors.email}>
          <input className={inputCls} type="email" autoComplete="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((p) => ({ ...p, email: "" })); }} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password}>
          <input className={inputCls} type="password" autoComplete="current-password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors((p) => ({ ...p, password: "" })); }} placeholder="Your password" />
        </Field>
        <div className="text-right">
          <button type="button" onClick={forgot} className="text-sm font-semibold text-brandstrong">Forgot password?</button>
        </div>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Btn>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or continue with<span className="h-px flex-1 bg-line" /></div>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => social("google")}>Google</Btn>
        <Btn variant="ghost" onClick={() => social("github")}>GitHub</Btn>
      </div>
      <p className="mt-5 text-center text-sm text-muted">New to LearnTest? <Link href="/sign-up" className="font-semibold text-brandstrong">Create an account</Link></p>
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCard title="Welcome back" sub="Sign in with the email you registered with."><FormSkeleton fields={2} label="Loading sign-in…" /></AuthCard>}>
      <SignInForm />
    </Suspense>
  );
}
