"use client";
import { useEffect, useMemo, useState } from "react";
import { Btn, Empty, ErrorBox, Loading, PageHead, useToast } from "@/components/ui";
import { apiDelete, apiGet, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { AvatarImg } from "@/components/profile";
import type { Page, TeacherProfile } from "@/lib/types";

type Tab = "general" | "security";

function BlockedTeachers() {
  const toast = useToast();
  const blocks = useFetch(() => apiGet<Page<{ teacherId: string }>>("/api/v1/blocks/me?limit=100"), []);
  const teachers = useFetch(() => apiGet<Page<TeacherProfile>>(`/api/v1/teachers${qs({ limit: 100 })}`), []);
  const [open, setOpen] = useState(false);
  const loading = blocks.loading || teachers.loading;
  const error = blocks.error || teachers.error;

  const rows = useMemo(() => {
    const byId = new Map((teachers.data?.items ?? []).map((t) => [String(t.userId), t]));
    return (blocks.data?.items ?? []).map((b) => ({
      teacherId: String(b.teacherId),
      profile: byId.get(String(b.teacherId)),
    }));
  }, [blocks.data, teachers.data]);

  const unblock = async (teacherId: string) => {
    try {
      await apiDelete(`/api/v1/blocks/${teacherId}`);
      toast("Teacher unblocked.");
      blocks.retry();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not unblock.", "err");
    }
  };

  const retryAll = () => { blocks.retry(); teachers.retry(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section aria-label="Blocked teachers" className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="block w-full rounded-xl border border-line p-4 text-left transition hover:bg-soft"
      >
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[16px] font-bold">Blocked Teachers</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              {loading ? "Loading…" : rows.length ? `${rows.length} blocked — select to manage` : "Select to view teachers you blocked"}
            </span>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Blocked teachers">
          <button aria-label="Close blocked teachers" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <h3 className="text-[17px] font-bold">Blocked Teachers</h3>
                <p className="text-[13px] text-muted">Unblock anyone to see their content again.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? <Loading label="Loading blocked teachers…" /> : error ? <ErrorBox message={error} onRetry={retryAll} /> :
                !rows.length ? <Empty title="No blocked teachers" body="Teachers you block will appear here." /> : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {rows.map((r) => (
                      <li key={r.teacherId} className="flex items-center gap-3 p-4">
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-xs font-bold">
                          {r.profile?.avatarUploadId ? (
                            <AvatarImg uploadId={r.profile.avatarUploadId} name={r.profile?.name || r.profile?.email || "Teacher"} className="h-full w-full" />
                          ) : (
                            (r.profile?.name || r.profile?.email || "T").trim().slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{r.profile?.name || r.profile?.email || "Teacher"}</p>
                          <p className="truncate text-[13px] text-muted">{r.profile?.bio || "Teacher on LearnTest"}</p>
                        </div>
                        <Btn variant="ghost" onClick={() => unblock(r.teacherId)}>Unblock</Btn>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-5">
              <Btn variant="ghost" onClick={() => setOpen(false)}>Close</Btn>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function ComingSoonRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5 opacity-70" aria-disabled="true">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[13px] text-muted">{body}</p>
      </div>
      <span className="shrink-0 rounded-md bg-soft px-2.5 py-1 text-xs font-bold text-muted">Coming soon</span>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div>
      <PageHead title="Settings" sub="Manage your account" />
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Settings sections" className="grid gap-1.5">
          {(
            [
              { key: "general", label: "General", icon: <path d="M12 5v14M5 12h14" /> },
              { key: "security", label: "Password & Security", icon: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></> },
            ] as const
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-[15px] transition ${active ? "bg-[#e8f1fe] font-semibold text-[#1d6ce0] dark:bg-soft" : "text-muted hover:bg-soft hover:text-ink"}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
                {t.label}
              </button>
            );
          })}
        </nav>

        <section className="rounded-2xl border border-line bg-card p-5 sm:p-7" aria-label={tab === "general" ? "General settings" : "Password and security"}>
          {tab === "general" ? (
            <div className="rounded-xl border border-dashed border-line bg-soft px-6 py-12 text-center">
              <h2 className="font-display text-xl font-bold">General preferences coming soon</h2>
              <p className="mt-1.5 text-sm text-muted">Notification and display preferences will live here.</p>
            </div>
          ) : (
            <div>
              <h2 className="font-display text-xl font-bold">Password & Security</h2>
              <p className="mt-1 text-sm text-muted">Keep your account safe and control who can reach you.</p>
              <div className="mt-4 grid gap-2.5">
                <ComingSoonRow title="Change password" body="Update the password you sign in with." />
                <ComingSoonRow title="Two-factor authentication" body="Add an extra verification step at sign-in." />
              </div>
              <BlockedTeachers />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
