"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { apiGet, apiPatch, apiUpload, ApiError, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AvatarImg, CoverBanner } from "@/components/profile";
import { useFetch } from "@/lib/hooks";
import type { MyTestPage, Page, UploadDoc, Video } from "@/lib/types";

type Tab = "overview" | "reviews";

const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]";
const editBtnCls = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

function StatMini({ icon, value, label, href }: { icon: React.ReactNode; value: string; label: string; href?: string }) {
  const body = (
    <>
      {icon}
      <div>
        <p className="text-[22px] font-bold leading-none tracking-tight">{value}</p>
        <p className="mt-1.5 text-[13px] text-muted">{label}</p>
      </div>
    </>
  );
  const cls = "flex items-center gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={`${cls} transition hover:border-brand hover:shadow`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

export default function TeacherProfilePage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, limit: 100 })}`), []);
  const tests = useFetch(() => apiGet<MyTestPage>(`/api/v1/my-tests${qs({ limit: 1 })}`), []);
  const followers = useFetch(() => apiGet<{ total: number }>(`/api/v1/follows/followers${qs({ limit: 1 })}`), []);
  const loading = videos.loading || tests.loading || followers.loading;
  const error = videos.error || tests.error || followers.error;

  const publishedVideos = useMemo(
    () => (videos.data?.items ?? []).filter((v) => v.status === "published").length,
    [videos.data],
  );
  const topTags = useMemo(() => {
    if (user?.skills?.length) return user.skills;
    const counts = new Map<string, number>();
    for (const v of videos.data?.items ?? []) for (const t of v.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [videos.data, user?.skills]);

  const displayName = user?.name || "Teacher";
  const username = user?.username ? `@${user.username}` : user?.email ? `@${user.email.split("@")[0]}` : "";
  const soon = (what: string) => toast(`${what} is coming soon.`);
  const goEdit = () => router.push("/teacher/profile/edit");
  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const doc = await apiUpload<UploadDoc>("/api/v1/uploads/avatar", file);
      await apiPatch("/api/v1/me", { avatarUploadId: doc._id });
      await refresh();
      toast("Avatar uploaded. Scan state: " + doc.scanStatus.replace("_", " "));
    } catch (e) { toast(e instanceof ApiError ? e.message : "Avatar upload failed.", "err"); }
    finally { setUploading(false); }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {loading ? <div className="mt-6"><Loading label="Loading profile…" /></div>
        : error ? <div className="mt-6"><ErrorBox message={error} onRetry={() => { videos.retry(); tests.retry(); followers.retry(); }} /></div>
        : (
          <>
            {/* cover */}
            <div className="relative h-40 overflow-hidden rounded-t-xl bg-gradient-to-r from-[#3b5bdb] via-[#748ffc] to-[#9775fa] sm:h-48" role="img" aria-label="Profile cover">
              {user?.coverUploadId ? (
                <CoverBanner uploadId={user.coverUploadId} className="absolute inset-0 h-full w-full" />
              ) : (
                <div aria-hidden className="absolute inset-0 opacity-30 [background:radial-gradient(60%_90%_at_20%_100%,#fff_0%,transparent_60%),radial-gradient(50%_80%_at_80%_20%,#fff_0%,transparent_55%)]" />
              )}
              <button type="button" onClick={goEdit}
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-[13px] font-semibold shadow">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                Change Cover
              </button>
            </div>

            {/* identity card */}
            <section className={`${cardCls} relative rounded-t-none`} aria-label="Profile summary">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative z-10 -mt-16 h-28 w-28 shrink-0 sm:-mt-20 sm:h-32 sm:w-32">
                  <span aria-hidden className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e8f1fe] text-3xl font-bold text-[#1d6ce0] ring-4 ring-card">
                    {user?.avatarUploadId ? (
                      <AvatarImg uploadId={user.avatarUploadId} name={displayName} className="h-full w-full" />
                    ) : (
                      initialsOf(displayName)
                    )}
                  </span>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Change profile photo"
                    aria-label="Change profile photo"
                    className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted shadow hover:text-ink disabled:opacity-50">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                  </button>
                  <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" aria-label="Choose profile photo" className="hidden"
                    onChange={(e) => { void uploadAvatar(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[22px] font-bold tracking-tight">
                    {displayName}
                    {user?.emailVerified && (
                      <svg viewBox="0 0 24 24" aria-label="Verified email" className="h-5 w-5 text-[#1d6ce0]" fill="currentColor"><path d="M12 2 14.5 4.5 18 4l.5 3.5L22 9l-1.5 3L22 15l-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l1.5-3L2 9l3.5-1.5L6 4l3.5.5z" /><path d="m9 12 2.2 2.2L15.5 10" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </p>
                  {username && <p className="text-sm text-muted">{username}</p>}
                  <p className="mt-0.5 text-sm font-medium">Teacher{user?.subject ? ` • ${user.subject}` : ""}</p>
                  <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-muted">{user?.bio || "No bio yet — tell students what you teach."}</p>
                </div>
                <button type="button" onClick={goEdit}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                  Edit Profile
                </button>
              </div>
            </section>

            {/* stats */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatMini value={String(publishedVideos)} label="Published Videos" href="/teacher/videos?from=profile"
                icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fe] text-[#2f80ed]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5l5-2.8v8.6l-5-2.8" /><circle cx="8.5" cy="12" r="1.6" /></svg></span>} />
              <StatMini value={String(tests.data?.total ?? 0)} label="Created Tests" href="/teacher/exams?from=profile"
                icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f1eafe] text-[#7c3aed]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg></span>} />
              <StatMini value={(followers.data?.total ?? 0).toLocaleString()} label="Followers" href="/teacher/students?from=profile"
                icon={<span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg></span>} />
              <StatMini value="—" label="Average Rating (no ratings API)"
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
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[17px] font-bold">About Me</h2>
                      <button type="button" onClick={goEdit} className={editBtnCls}>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                        Edit
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{user?.bio || "No bio yet — tell students what you teach."}</p>
                    {user?.university && (
                      <p className="mt-3 flex items-start gap-2.5 text-sm">
                        <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></svg>
                        <span><span className="font-semibold">{user.university}</span>{user.degree && <span className="block text-muted">{user.degree}</span>}</span>
                      </p>
                    )}
                    {user?.location && (
                      <p className="mt-2 flex items-center gap-2.5 text-sm">
                        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                        {user.location}
                      </p>
                    )}
                  </section>

                  <section className={cardCls} aria-label="Skills and Topics">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[17px] font-bold">Skills & Topics</h2>
                      <button type="button" onClick={goEdit} className={editBtnCls}>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                        Edit
                      </button>
                    </div>
                    {topTags.length ? (
                      <p className="mt-3 flex flex-wrap gap-2">
                        {topTags.map((t) => (
                          <span key={t} className="rounded-lg bg-[#eff6ff] px-3 py-1.5 text-[13px] font-medium text-[#1d4ed8] dark:bg-soft">{t}</span>
                        ))}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">Topics you tag your videos with will appear here.</p>
                    )}
                  </section>

                  <section className={cardCls} aria-label="Social Links">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[17px] font-bold">Social Links</h2>
                      <button type="button" onClick={goEdit} className={editBtnCls}>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                        Edit
                      </button>
                    </div>
                    {(() => {
                      const links = [
                        { key: "github", label: "GitHub", badge: "bg-[#111827] text-white", mark: "GH", href: user?.socials?.github ?? "" },
                        { key: "youtube", label: "YouTube", badge: "bg-[#dc2626] text-white", mark: "YT", href: user?.socials?.youtube ?? "" },
                        { key: "linkedin", label: "LinkedIn", badge: "bg-[#0a66c2] text-white", mark: "in", href: user?.socials?.linkedin ?? "" },
                        { key: "dev", label: "DEV", badge: "bg-black text-white", mark: "DEV", href: user?.socials?.dev ?? "" },
                        { key: "website", label: "Website", badge: "bg-[#1d6ce0] text-white", mark: "✦", href: user?.socials?.website ?? "" },
                      ].filter((l) => l.href.trim());
                      return links.length ? (
                        <p className="mt-3 flex flex-wrap gap-2">
                          {links.map((l) => (
                            <a key={l.key} href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}
                              className={`flex h-9 w-11 items-center justify-center rounded-lg text-[11px] font-black ${l.badge}`}>{l.mark}</a>
                          ))}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted">No social links added yet.</p>
                      );
                    })()}
                  </section>
                </div>

                <section className={`${cardCls} xl:col-span-2`} aria-label="Reviews">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-bold">Reviews</h2>
                    <button type="button" onClick={() => soon("Full review list")} className="text-sm font-semibold text-[#1d6ce0] hover:underline">View All</button>
                  </div>
                  <div className="mt-2"><Empty title="No reviews yet" body="Student reviews will appear here once a reviews endpoint exists." /></div>
                </section>
              </div>
            ) : (
              <section className={`${cardCls} mt-4`} aria-label="All reviews">
                <Empty title="No reviews yet" body="Student reviews will appear here once a reviews endpoint exists." />
              </section>
            )}
          </>
        )}

    </div>
  );
}
