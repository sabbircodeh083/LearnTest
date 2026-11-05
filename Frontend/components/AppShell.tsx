"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { AvatarImg } from "./profile";
import type { Role } from "@/lib/types";

export const STUDENT_NAV = [
  ["Home", "/student"], ["Videos", "/student?tab=videos"], ["Playlist", "/student?tab=playlists"], ["Tests", "/student?tab=tests"], ["My Submissions", "/student/submissions"],
  ["Results & Feedback", "/student/graded-submissions"], ["Saved Content", "/student/saved-content"], ["Purchased Content", "/student/purchases"],
  ["Purchase Statements", "/student/statements"],
  ["Following Teachers", "/student/following"], ["Profile", "/student/profile"], ["Settings", "/student/settings"],
] as const;

export const TEACHER_NAV = [
  ["Dashboard", "/teacher"], ["Videos", "/teacher/videos"], ["Playlists", "/teacher/playlists"],
  ["All Tests", "/teacher/exams"], ["Create Test", "/teacher/exams/new"], ["Submissions & Feedback", "/teacher/submissions"], ["Archive", "/teacher/archive"], ["Followers", "/teacher/students"],
  ["Analysis", "/teacher/analytics"], ["Earning", "/teacher/earnings"], ["Profile", "/teacher/profile"], ["Settings", "/teacher/settings"],
] as const;

export const ADMIN_NAV = [
  ["Overview", "/admin"], ["Users", "/admin/users"], ["Payments", "/admin/payments"], ["Payout", "/admin/payouts"],
  ["Reports", "/admin/reports"], ["Analytics", "/admin/analytics"], ["Audit Logs", "/admin/audit-logs"],
] as const;

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("learntest-theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("learntest-theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold">
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-[#f5a623]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z" />
        </svg>
      )}
    </button>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <img src="/logo.png" alt="LearnTest logo" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
      <span className="font-display text-lg font-bold tracking-tight">LearnTest</span>
    </Link>
  );
}

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/sign-in"); return; }
    // Only users without a completed role choice are sent to onboarding.
    if (!user.roleSelected && user.role !== "admin") { router.replace("/select-role"); return; }
    if (user.role !== role) router.replace(roleHome(user.role));
  }, [user, loading, role, router]);

  if (loading) return <div className="p-8 text-sm text-muted" aria-busy="true">Checking your session…</div>;
  if (!user) return <div className="p-8 text-sm text-muted">Redirecting…</div>;
  if (!user.roleSelected && user.role !== "admin") return <div className="p-8 text-sm text-muted">Redirecting…</div>;
  if (user.role !== role) return <div className="p-8 text-sm text-muted">Redirecting…</div>;
  return <>{children}</>;
}

function NavIcon({ label, className }: { label: string; className?: string }) {
  const cls = className ?? "h-5 w-5 shrink-0";
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className: cls } as const;
  switch (label) {
    case "Dashboard":
    case "Home":
    case "Overview":
      return (<svg viewBox="0 0 24 24" {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>);
    case "Videos":
      return (<svg viewBox="0 0 24 24" {...common}><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>);
    case "Playlists":
    case "Playlist":
      return (<svg viewBox="0 0 24 24" {...common}><path d="M4 6h12M4 10h12M4 14h7" /><circle cx="18" cy="17" r="3" /><path d="M20.5 14.5V17H18" /></svg>);
    case "All Tests":
    case "Exams":
    case "My Exams":
    case "Tests":
      return (<svg viewBox="0 0 24 24" {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0" /><path d="M9 11h6M9 15h4" /></svg>);
    case "Create Test":
      return (<svg viewBox="0 0 24 24" {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>);
    case "Submissions & Feedback":
      return (<svg viewBox="0 0 24 24" {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6" /><path d="m9.5 17 1.5 1.5 3-3" /></svg>);
    case "Archive":
      return (<svg viewBox="0 0 24 24" {...common}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></svg>);
    case "Followers":
    case "Following Teachers":
    case "Students":
      return (<svg viewBox="0 0 24 24" {...common}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.6c2.9.4 5 2.7 5 5.4" /></svg>);
    case "Analysis":
    case "Analytics":
      return (<svg viewBox="0 0 24 24" {...common}><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></svg>);
    case "Earning":
    case "Earnings":
      return (<svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M14.5 9.5c-.6-1-1.5-1.3-2.5-1.3-1.4 0-2.5.8-2.5 2 0 2.7 5.5 1.3 5.5 4 0 1.2-1.1 2-2.5 2-1 0-1.9-.4-2.5-1.3" /></svg>);
    case "Settings":
      return (<svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z" /></svg>);
    case "Profile":
      return (<svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>);
    default:
      return (<svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /></svg>);
  }
}

export function AppShell({ nav, roleLabel, children }: {
  nav: readonly (readonly [string, string])[]; roleLabel: string; children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Let small/medium-device users dismiss the drawer with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  // Longest-prefix match so nested pages (e.g. /teacher/exams/new) highlight one item.
  let activeHref = "";
  for (const [, href] of nav) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (href.length > activeHref.length) activeHref = href;
    }
  }
  const initial = (user?.name?.trim()?.[0] || user?.email?.[0] || "?").toUpperCase();

  const sidebar = (
    <nav aria-label={`${roleLabel} navigation`} className="flex h-full flex-col bg-card">
      <div className="px-5 pb-2 pt-5"><Logo /></div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {nav.map(([label, href]) => {
          const active = href === activeHref;
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${active ? "bg-brandsoft font-semibold text-brandstrong" : "text-ink hover:bg-soft"}`}>
                {active && <span aria-hidden className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand" />}
                <NavIcon label={label} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brandsoft font-display text-base font-bold text-brandstrong">
            {user?.avatarUploadId ? (
              <AvatarImg uploadId={user.avatarUploadId} name={user?.name || user?.email || "?"} className="h-full w-full" />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name || user?.email}</p>
            <p className="truncate text-xs capitalize text-muted">{user?.role ?? roleLabel}</p>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => { await signOut(); router.push("/"); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-soft hover:text-danger">
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-card lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimize sidebar" title="Minimize sidebar"
              className="absolute -right-4 top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted shadow-md transition hover:bg-soft hover:text-ink">
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
            </button>
            <div className="flex-1 overflow-hidden">{sidebar}</div>
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
          <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold lg:hidden"
            aria-expanded={open} aria-label="Open sidebar menu" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            Menu</button>
          <div className="lg:hidden"><Logo /></div>
          <Link href={roleHome(user?.role)} className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brandsoft font-display text-sm font-bold text-brandstrong">
              {user?.avatarUploadId ? (
                <AvatarImg uploadId={user.avatarUploadId} name={user?.name || user?.email || "?"} className="h-full w-full" />
              ) : (
                initial
              )}
            </span>
            <span className="hidden truncate text-sm font-semibold hover:text-brandstrong min-[400px]:block">
              {user?.name?.split(" ")[0] || user?.email || "Account"}
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
