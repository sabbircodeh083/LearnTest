"use client";
import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- primitives ---------- */
export function Btn({ href, onClick, children, variant = "primary", type, disabled, className = "" }: {
  href?: string; onClick?: () => void; children: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "soft"; type?: "submit" | "button"; disabled?: boolean; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const styles = {
    primary: "bg-brand text-white hover:bg-brandstrong",
    soft: "bg-brandsoft text-brandstrong hover:brightness-95",
    ghost: "border border-line bg-card text-ink hover:bg-soft",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  if (href) return <Link href={href} className={`${base} ${styles} ${className}`}>{children}</Link>;
  return <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>{children}</button>;
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand";

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "purple" | "orange";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones = {
    neutral: "bg-soft text-muted border-line",
    green: "bg-brandsoft text-brandstrong border-transparent",
    amber: "bg-warnsoft text-warn border-transparent",
    red: "bg-dangersoft text-danger border-transparent",
    blue: "bg-infosoft text-ink border-transparent",
    purple: "bg-[#ede9fe] text-[#7c3aed] border-transparent dark:bg-brandsoft dark:text-brandstrong",
    orange: "bg-[#ffedd5] text-[#c2410c] border-transparent dark:bg-warnsoft dark:text-warn",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones}`}>{children}</span>;
}

export function statusTone(status: string): "neutral" | "green" | "amber" | "red" | "blue" {
  if (["published", "paid", "clean", "graded", "active"].includes(status)) return "green";
  if (["draft", "pending", "pending_scan", "submitted", "under_review", "in_progress"].includes(status)) return "amber";
  if (["failed", "infected", "suspicious", "scan_failed", "hidden", "rejected", "suspended", "cancelled", "expired"].includes(status)) return "red";
  return "neutral";
}

/* ---------- states ---------- */
import { ListSkeleton } from "./Skeleton";
export function Loading({ label = "Loading…" }: { label?: string }) {
  return <ListSkeleton rows={4} label={label} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-dangersoft p-4">
      <p className="text-sm font-semibold text-danger">Could not load this page</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && <Btn variant="ghost" className="mt-3" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-soft p-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="animate-fade-up mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "blue" | "red" }) {
  const cls = tone === "red" ? "bg-dangersoft text-danger" : tone === "blue" ? "bg-infosoft" : "bg-warnsoft text-warn";
  return <div role={tone === "red" ? "alert" : "note"} className={`rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** Inline error under a field. Render only when there is a message. */
export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{children}</p>;
}

/** Append to an input's className when the field has an error. */
export const errCls = (hasError?: unknown) => (hasError ? " !border-danger" : "");

/* ---------- toast ---------- */
import { createContext, useCallback, useContext, useState } from "react";
const ToastCtx = createContext<(msg: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: "ok" | "err" }[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[110] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="animate-toast-in pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-medium text-ink shadow-2xl">
            <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.tone === "err" ? "bg-dangersoft text-danger" : "bg-brandsoft text-brandstrong"}`}>
              {t.tone === "err" ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 8v5M12 16.5v.01" /><circle cx="12" cy="12" r="8.5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
              )}
            </span>
            <span className="min-w-0 flex-1 pt-1">{t.msg}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-soft hover:text-ink">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
