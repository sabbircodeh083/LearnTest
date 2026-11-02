"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Btn, Empty, ErrorBox, Loading, PageHead, useToast } from "@/components/ui";
import { apiDelete, apiGet, ApiError, qs } from "@/lib/api";
import { useFetch, useDebouncedValue } from "@/lib/hooks";
import { AvatarImg } from "@/components/profile";
import type { Page, TeacherProfile } from "@/lib/types";

export default function FollowingPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  // Filter only after the user pauses typing for 2s — not on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 2000);
  const typing = search !== debouncedSearch;
  const teachers = useFetch(() => apiGet<Page<TeacherProfile>>(`/api/v1/teachers${qs({ limit: 100 })}`), []);
  const follows = useFetch(() => apiGet<Page<{ teacherId: string }>>("/api/v1/follows/me?limit=100"), []);
  const loading = teachers.loading || follows.loading;
  const error = teachers.error || follows.error;

  const followed = useMemo(() => {
    const ids = new Set((follows.data?.items ?? []).map((f) => f.teacherId));
    const q = debouncedSearch.trim().toLowerCase();
    return (teachers.data?.items ?? [])
      .filter((t) => ids.has(t.userId))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [teachers.data, follows.data, debouncedSearch]);

  const unfollow = async (teacherId: string) => {
    try { await apiDelete(`/api/v1/follows/${teacherId}`); toast("Unfollowed."); follows.retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not unfollow.", "err"); }
  };

  const retryAll = () => { teachers.retry(); follows.retry(); };

  return (
    <div>
      <PageHead title="Following Teachers" sub="Teachers you follow, saved on your account." />
      <div className="relative mb-6 max-w-xl">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <label className="sr-only" htmlFor="following-search">Search followed teachers</label>
        <input id="following-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search followed teachers by name…" className="w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70" />
      </div>
      {typing && <p className="mb-4 text-xs text-muted" role="status">Waiting for you to stop typing…</p>}
      {loading ? <Loading label="Loading followed teachers…" /> : error ? <ErrorBox message={error} onRetry={retryAll} /> :
        !followed.length ? <Empty
          title={debouncedSearch ? "No matches" : "You're not following anyone yet"}
          body={debouncedSearch ? `Nothing matched “${debouncedSearch.trim()}”.` : "Follow teachers from their videos or tests to find them again quickly."}
        /> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {followed.map((t) => (
              <article key={t.userId} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <Link href={`/student/teachers/${t.userId}`} aria-label={`${t.name || t.email}'s profile`} className="shrink-0">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-soft text-xs font-bold">
                      {t.avatarUploadId ? (
                        <AvatarImg uploadId={t.avatarUploadId} name={t.name || t.email} className="h-full w-full" />
                      ) : (
                        (t.name || t.email || "?").trim().slice(0, 2).toUpperCase()
                      )}
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><Link href={`/student/teachers/${t.userId}`} className="hover:text-brandstrong">{t.name || t.email}</Link></p>
                    <p className="truncate text-sm text-muted">{t.bio || "Teacher on LearnTest"}</p>
                  </div>
                  <Btn variant="ghost" onClick={() => unfollow(t.userId)}>Unfollow</Btn>
                </div>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}
