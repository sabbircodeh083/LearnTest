"use client";
import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Btn, Empty, ErrorBox, Loading, statusTone, useToast } from "@/components/ui";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate } from "@/lib/types";

type Tab = "overview" | "reviews";

const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]";

interface AdminUserDetail {
  userId: string;
  email: string;
  emailVerified?: boolean;
  name: string;
  role: string;
  roleSelected: boolean;
  status: string;
  bio: string;
  suspensionReason?: string;
  createdAt: string;
  username?: string;
  subject?: string;
  university?: string;
  degree?: string;
  location?: string;
  skills?: string[];
  socials?: { github?: string; youtube?: string; linkedin?: string; dev?: string; website?: string };
  stats?: { publishedVideos: number; createdTests: number; followers: number; averageRating: number | null; ratingCount: number };
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

function StatMini({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      {icon}
      <div>
        <p className="text-[22px] font-bold leading-none tracking-tight">{value}</p>
        <p className="mt-1.5 text-[13px] text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function AdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading profile…" />}>
      <AdminUserProfileInner params={params} />
    </Suspense>
  );
}

function AdminUserProfileInner({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const search = useSearchParams();
  const fromReports = search.get("from") === "reports";
  const backHref = fromReports ? "/admin/reports" : "/admin/users";
  const backLabel = fromReports ? "Reports" : "Users";
  const { data: u, error, loading, retry } = useFetch(() => apiGet<AdminUserDetail>(`/api/v1/admin/users/${userId}`), [userId]);
  if (loading) return <Loading label="Loading profile…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!u) return <ErrorBox message="User not found." onRetry={retry} />;

  const changeRole = async () => {
    const next = u.role === "student" ? "teacher" : "student";
    const reason = window.prompt(`Change ${u.email} to ${next}? Reason required.`);
    if (!reason || reason.trim().length < 3) { if (reason !== null) toast("Reason required (min 3 characters).", "err"); return; }
    try { await apiPatch(`/api/v1/admin/users/${u.userId}/role`, { role: next, reason: reason.trim() }); toast("Role updated."); retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Role change failed.", "err"); }
  };
  const toggleStatus = async () => {
    const next = u.status === "active" ? "suspended" : "active";
    const reason = window.prompt(`${next === "suspended" ? "Suspend" : "Reactivate"} ${u.email}? Reason required.`);
    if (!reason || reason.trim().length < 3) { if (reason !== null) toast("Reason required (min 3 characters).", "err"); return; }
    try { await apiPatch(`/api/v1/admin/users/${u.userId}/status`, { status: next, reason: reason.trim() }); toast("Status updated."); retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Status change failed.", "err"); }
  };

  const displayName = u.name || u.email;
  const username = u.username ? `@${u.username}` : u.email ? `@${u.email.split("@")[0]}` : "";
  const roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
  const stats = u.stats ?? { publishedVideos: 0, createdTests: 0, followers: 0, averageRating: null, ratingCount: 0 };
  const socials = [
    { key: "github", label: "GitHub", badge: "bg-[#111827] text-white", mark: "GH", href: u.socials?.github ?? "" },
    { key: "youtube", label: "YouTube", badge: "bg-[#dc2626] text-white", mark: "YT", href: u.socials?.youtube ?? "" },
    { key: "linkedin", label: "LinkedIn", badge: "bg-[#0a66c2] text-white", mark: "in", href: u.socials?.linkedin ?? "" },
    { key: "dev", label: "DEV", badge: "bg-black text-white", mark: "DEV", href: u.socials?.dev ?? "" },
    { key: "website", label: "Website", badge: "bg-[#1d6ce0] text-white", mark: "✦", href: u.socials?.website ?? "" },
  ].filter((l) => l.href.trim());

  const reviewsBody = stats.ratingCount > 0 ? (
    <div className="mt-2 rounded-xl bg-soft p-5 text-center">
      <p className="font-display text-3xl font-bold">{stats.averageRating ?? "—"} ★</p>
      <p className="mt-1 text-sm text-muted">Average from {stats.ratingCount} rating{stats.ratingCount === 1 ? "" : "s"}. Individual written reviews are not stored.</p>
    </div>
  ) : (
    <div className="mt-2"><Empty title="No reviews yet" body="This user has not received any ratings yet." /></div>
  );

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>

      {/* cover */}
      <div className="relative mt-3 h-40 overflow-hidden rounded-t-xl bg-gradient-to-r from-[#3b5bdb] via-[#748ffc] to-[#9775fa] sm:h-48" role="img" aria-label="Profile cover">
        <div aria-hidden className="absolute inset-0 opacity-30 [background:radial-gradient(60%_90%_at_20%_100%,#fff_0%,transparent_60%),radial-gradient(50%_80%_at_80%_20%,#fff_0%,transparent_55%)]" />
      </div>

      {/* identity card */}
      <section className={`${cardCls} relative rounded-t-none`} aria-label="Profile summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative -mt-16 h-28 w-28 shrink-0 sm:-mt-20 sm:h-32 sm:w-32">
            <span aria-hidden className="flex h-full w-full items-center justify-center rounded-full bg-[#e8f1fe] text-3xl font-bold text-[#1d6ce0] ring-4 ring-card">
              {initialsOf(displayName)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[22px] font-bold tracking-tight">
              {displayName}
              {u.emailVerified && (
                <svg viewBox="0 0 24 24" aria-label="Verified email" className="h-5 w-5 text-[#1d6ce0]" fill="currentColor"><path d="M12 2 14.5 4.5 18 4l.5 3.5L22 9l-1.5 3L22 15l-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l1.5-3L2 9l3.5-1.5L6 4l3.5.5z" /><path d="m9 12 2.2 2.2L15.5 10" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </p>
            {username && <p className="text-sm text-muted">{username}</p>}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium">
              {roleLabel}{u.subject ? ` • ${u.subject}` : ""}
              <Badge tone={statusTone(u.status)}>{u.status}</Badge>
              <Badge>{u.roleSelected ? "Role selected" : "Role not selected"}</Badge>
            </p>
            <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-muted">{u.bio || "No bio yet."}</p>
            <p className="mt-1 text-[13px] text-muted">{u.email} · Joined {fmtDate(u.createdAt)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            {u.role !== "admin" && <Btn onClick={changeRole}>Make {u.role === "student" ? "teacher" : "student"}</Btn>}
            <Btn variant="ghost" onClick={toggleStatus}>{u.status === "active" ? "Suspend" : "Reactivate"}</Btn>
          </div>
        </div>
        {u.status === "suspended" && u.suspensionReason && (
          <p role="note" className="mt-3 rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger">Suspended: {u.suspensionReason}</p>
        )}
      </section>

      {/* stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatMini value={String(stats.publishedVideos)} label="Published Videos"
          icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fe] text-[#2f80ed]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5l5-2.8v8.6l-5-2.8" /><circle cx="8.5" cy="12" r="1.6" /></svg></span>} />
        <StatMini value={String(stats.createdTests)} label="Created Tests"
          icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f1eafe] text-[#7c3aed]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg></span>} />
        <StatMini value={stats.followers.toLocaleString()} label="Followers"
          icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg></span>} />
        <StatMini value={stats.averageRating != null ? String(stats.averageRating) : "—"} label={stats.ratingCount ? `Average Rating (${stats.ratingCount} rating${stats.ratingCount === 1 ? "" : "s"})` : "Average Rating"}
          icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fef3e2] text-[#d97706]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg></span>} />
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-6 border-b border-line" role="tablist" aria-label="Profile sections">
        {(["overview", "reviews"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 pb-2.5 text-[15px] font-medium ${tab === t ? "border-[#1d6ce0] font-semibold text-[#1d6ce0]" : "border-transparent text-muted hover:text-ink"}`}>
            {t === "overview" ? "Overview" : "Reviews"}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            <section className={cardCls} aria-label="About Me">
              <h2 className="text-[17px] font-bold">About Me</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{u.bio || "No bio yet."}</p>
              {u.university && (
                <p className="mt-3 flex items-start gap-2.5 text-sm">
                  <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></svg>
                  <span><span className="font-semibold">{u.university}</span>{u.degree && <span className="block text-muted">{u.degree}</span>}</span>
                </p>
              )}
              {u.location && (
                <p className="mt-2 flex items-center gap-2.5 text-sm">
                  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                  {u.location}
                </p>
              )}
              <dl className="mt-3 grid grid-cols-[110px_1fr] gap-2 border-t border-line pt-3 text-sm">
                <dt className="text-muted">Email</dt><dd className="break-all">{u.email}</dd>
                <dt className="text-muted">User ID</dt><dd className="break-all font-mono text-xs">{u.userId}</dd>
                <dt className="text-muted">Joined</dt><dd>{fmtDate(u.createdAt)}</dd>
              </dl>
            </section>

            <section className={cardCls} aria-label="Skills and Topics">
              <h2 className="text-[17px] font-bold">Skills & Topics</h2>
              {(u.skills ?? []).length ? (
                <p className="mt-3 flex flex-wrap gap-2">
                  {(u.skills ?? []).map((t) => (
                    <span key={t} className="rounded-lg bg-[#eff6ff] px-3 py-1.5 text-[13px] font-medium text-[#1d4ed8] dark:bg-soft">{t}</span>
                  ))}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">No skills listed.</p>
              )}
            </section>

            <section className={cardCls} aria-label="Social Links">
              <h2 className="text-[17px] font-bold">Social Links</h2>
              {socials.length ? (
                <p className="mt-3 flex flex-wrap gap-2">
                  {socials.map((l) => (
                    <a key={l.key} href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}
                      className={`flex h-9 w-11 items-center justify-center rounded-lg text-[11px] font-black ${l.badge}`}>{l.mark}</a>
                  ))}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">No social links added.</p>
              )}
            </section>
          </div>

          <section className={`${cardCls} xl:col-span-2`} aria-label="Reviews">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold">Reviews</h2>
              <button type="button" onClick={() => setTab("reviews")} className="text-sm font-semibold text-[#1d6ce0] hover:underline">View All</button>
            </div>
            {reviewsBody}
          </section>
        </div>
      ) : (
        <section className={`${cardCls} mt-4`} aria-label="All reviews">
          <h2 className="text-[17px] font-bold">Reviews</h2>
          {reviewsBody}
        </section>
      )}

      <p className="mt-4 text-xs text-muted">Admin accounts are created only through the backend CLI process, never from this screen.</p>
    </div>
  );
}
