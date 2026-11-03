"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AvatarImg } from "@/components/profile";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { DataList, DataRow, RowIcon } from "@/components/DataList";
import { apiGet, ApiError, qs } from "@/lib/api";
import { fmtDate } from "@/lib/types";

const PAGE_SIZE = 20;
type DateKey = "all" | "today" | "last7" | "last30";

interface Follower {
  _id: string;
  followerId: string;
  name: string;
  email: string;
  username: string;
  bio: string;
  avatarUploadId: string | null;
  followedAt: string;
}
interface FollowerPage { items: Follower[]; total: number; page?: number; limit?: number }

const AVATAR_TONES = [
  "bg-[#e8f1fe] text-[#1d6ce0]", "bg-[#fde6f2] text-[#c2185b]", "bg-[#e6f9ec] text-[#16a34a]",
  "bg-[#f1eafe] text-[#7c3aed]", "bg-[#feecdc] text-[#ea580c]", "bg-[#e0f2f1] text-[#00796b]",
];
function toneOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

const inputCls = "rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 shadow-[0_1px_3px_rgba(16,24,40,0.10)] outline-none focus:border-line focus:shadow-[0_2px_8px_rgba(16,24,40,0.12)]";

function BackToProfile() {
  const sp = useSearchParams();
  if (sp.get("from") !== "profile") return null;
  return (
    <Link href="/teacher/profile" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Profile</Link>
  );
}

export default function TeacherFollowersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [items, setItems] = useState<Follower[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const reqSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    const seq = ++reqSeq.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const now = Date.now();
      const from = dateKey === "today" ? new Date(now - 86400000).toISOString()
        : dateKey === "last7" ? new Date(now - 7 * 86400000).toISOString()
        : dateKey === "last30" ? new Date(now - 30 * 86400000).toISOString()
        : undefined;
      const data = await apiGet<FollowerPage>(`/api/v1/follows/followers${qs({
        page: p, limit: PAGE_SIZE, search: debounced || undefined, from,
      })}`);
      if (seq !== reqSeq.current) return;
      setTotal(data.total);
      setPage(p);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(e instanceof ApiError ? e.message : "Could not load your followers.");
    } finally {
      if (seq === reqSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [debounced, dateKey]);

  useEffect(() => { void fetchPage(1, false); }, [fetchPage, nonce]);

  const hasMore = items.length < total;
  const soon = () => toast("Student profiles are coming soon.");

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Suspense>
        <BackToProfile />
      </Suspense>
      {/* header */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg>
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Followers</h1>
          <p className="text-[15px] text-muted">View and manage your followers.</p>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-5 card-hover" aria-label="Followers">
        {/* filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or username..."
              aria-label="Search by name or username" className={`${inputCls} w-full pl-9`} />
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">Join Date</span>
            <select value={dateKey} onChange={(e) => setDateKey(e.target.value as DateKey)} aria-label="Join Date" className={`${inputCls} w-[190px] font-semibold`}>
              <option value="all">All Time</option>
              <option value="today">Last 24 hours</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          </label>
        </div>

        {/* table */}
        <div className="mt-4">
          {loading ? <Loading label="Loading followers…" />
            : error ? <ErrorBox message={error} onRetry={() => setNonce((n) => n + 1)} />
            : !items.length ? <Empty title="No followers yet" body={debounced || dateKey !== "all" ? "Nothing matches this search or date filter. Clear them to see everyone." : "Students who follow you will appear here."} />
            : (
              <>
                <DataList label="Followers">
                  {items.map((f) => (
                    <DataRow
                      key={f._id}
                      icon={
                        <RowIcon tone={toneOf(f.followerId)} shape="rounded-full">
                          {f.avatarUploadId ? (
                            <AvatarImg uploadId={f.avatarUploadId} name={f.name} className="h-full w-full" />
                          ) : (
                            <span className="text-[13px] font-bold">{initialsOf(f.name)}</span>
                          )}
                        </RowIcon>
                      }
                      title={f.name}
                      meta={<>{f.username || f.email || `id ${f.followerId.slice(0, 8)}…`} · Joined {fmtDate(f.followedAt)}</>}
                      detail={f.bio || null}
                      actions={
                        <button type="button" onClick={soon}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                          View Profile
                        </button>
                      }
                    />
                  ))}
                </DataList>

                {/* footer */}
                <div className="mt-4 rounded-xl border border-line bg-card px-4 py-4 text-center">
                  {loadingMore ? (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-[#1d6ce0]">
                      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d6ce0] border-t-transparent" />
                      Loading more followers…
                    </p>
                  ) : hasMore ? (
                    <button type="button" onClick={() => void fetchPage(page + 1, true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d6ce0]">
                      Load more followers…
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-muted">All followers loaded</p>
                  )}
                  <p className="mt-1 text-[13px] text-muted">Showing {items.length} of {total} followers</p>
                </div>
              </>
            )}
        </div>
      </section>
    </div>
  );
}
