"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { FormSkeleton } from "@/components/Skeleton";
import { Btn, Field, inputCls, Notice } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth, roleHome, useRedirectIfSignedIn } from "@/lib/auth";
import { safeExternalUrl, safeReturnTo } from "@/lib/url";
import { checkEmail } from "@/lib/validation";

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const rawReturn = search.get("returnTo");
  const returnTo = safeReturnTo(rawReturn) || null;
  const resetDone = search.get("reset") === "1";
  const verifyError = search.get("error");
  const verifyFlow = search.get("verified") === "1";
  const justVerified = verifyFlow && !verifyError;
  const verifyFailed = verifyFlow && (verifyError === "INVALID_TOKEN" || verifyError === "TOKEN_EXPIRED");
  const invalidResetToken = !verifyFlow && (verifyError === "INVALID_TOKEN" || verifyError === "TOKEN_EXPIRED");
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
  const [socialBusy, setSocialBusy] = useState<"google" | "github" | null>(null);

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
      // Role onboarding comes first; only users without a selected role see it.
      if (!me.roleSelected && me.role !== "admin") router.replace("/select-role");
      else if (returnTo) router.replace(returnTo);
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
        callbackURL: `${window.location.origin}/sign-in?verified=1`,
      });
      setResent(true); setCooldown(60);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not resend. Try again in a minute.");
    } finally { setResending(false); }
  };

  const forgot = async () => {
    if (checkEmail(form.email)) { setErrors({ email: "Enter a valid email first, then choose Forgot password." }); return; }
    setServerError("");
    setResetSent(false);
    try {
      // Better Auth's real endpoint. Unknown emails deliberately return 200,
      // so any error here is a rate limit or a mail/server failure.
      await apiPost("/api/auth/request-password-reset", {
        email: form.email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setServerError("Too many reset requests. Please wait a minute and try again.");
      } else if (err instanceof ApiError && err.status >= 500) {
        setServerError("We could not send the reset email right now. Please try again shortly.");
      } else {
        setServerError(err instanceof ApiError ? err.message : "Could not send the reset email. Check your connection and try again.");
      }
    }
  };

  const social = async (provider: "google" | "github") => {
    if (socialBusy) return;
    setServerError("");
    setSocialBusy(provider);
    try {
      // Better Auth only exposes POST /sign-in/social. The provider is chosen
      // in the body; there is no GET /sign-in/:provider route.
      const data = await apiPost<{ url?: string }>("/api/auth/sign-in/social", {
        provider,
        callbackURL: `${window.location.origin}/`,
        // Return the authorize URL instead of relying on a Location header;
        // the browser is navigated explicitly below.
        disableRedirect: true,
      });
      const url = safeExternalUrl(data?.url);
      if (!url) {
        throw new ApiError(
          502,
          "OAUTH_FAILED",
          "The sign-in provider did not return an authorization URL. Please try again.",
        );
      }
      window.location.href = url;
    } catch (err) {
      setSocialBusy(null);
      let message =
        "Could not start social sign-in. Check your connection; if this keeps happening, the API is not allowing this site (check CORS_ORIGINS).";
      if (err instanceof ApiError) {
        if (err.status === 429) {
          message = "Too many sign-in attempts. Please wait a minute and try again.";
        } else if (err.code === "PROVIDER_NOT_FOUND") {
          message = `${
            provider === "google" ? "Google" : "GitHub"
          } sign-in is not configured on the server yet.`;
        } else if (
          err.code === "INVALID_ORIGIN" ||
          err.code === "INVALID_CALLBACK_URL" ||
          /cross-site request blocked/i.test(err.message)
        ) {
          message =
            "This site is not allowed to start sign-in. Add this origin to the API's CORS_ORIGINS/FRONTEND_URL and redeploy the backend.";
        } else {
          message = err.message;
        }
      }
      setServerError(message);
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
        {justVerified && <Notice tone="blue">Your email is verified. Sign in to continue.</Notice>}
        {verifyFailed && <Notice tone="red">That verification link is invalid or has expired. Sign in, then choose “Resend verification email”.</Notice>}
        {resetDone && <Notice tone="blue">Password updated. Sign in with your new password.</Notice>}
        {invalidResetToken && <Notice tone="red">That reset link is invalid or has expired. Request a new one below.</Notice>}
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
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={form.password}
          onChange={(password) => { setForm({ ...form, password }); setErrors((p) => ({ ...p, password: "" })); }}
          error={errors.password}
        />
        <div className="text-right">
          <button type="button" onClick={forgot} className="text-sm font-semibold text-brandstrong">Forgot password?</button>
        </div>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Btn>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or continue with<span className="h-px flex-1 bg-line" /></div>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => social("google")} disabled={socialBusy !== null}>
          {socialBusy === "google" ? "Connecting…" : "Google"}
        </Btn>
        <Btn variant="ghost" onClick={() => social("github")} disabled={socialBusy !== null}>
          {socialBusy === "github" ? "Connecting…" : "GitHub"}
        </Btn>
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
