"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarImg } from "@/components/profile";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { apiGet, ApiError, qs } from "@/lib/api";
import { fmtDate } from "@/lib/types";

const PAGE_SIZE = 20;
type StatusKey = "" | "published" | "draft";
type TypeFilter = "" | "written" | "project";
type DateKey = "all" | "today" | "last7" | "last30";

export interface QueueSubmission {
  id: string;
  source: "exam" | "assignment";
  testId: string;
  testTitle: string;
  kind: "written" | "project";
  student: { userId: string; name: string; email: string; avatarUploadId?: string | null };
  state: string;
  score: number | null;
  attemptNumber: number | null;
  submittedAt: string | null;
}
interface QueueItemsPage { items: QueueSubmission[]; total: number; page?: number; limit?: number }

const KIND_META: Record<string, { label: string; cls: string; box: string; icon: React.ReactNode }> = {
  written: {
    label: "Written", cls: "text-[#2563eb]", box: "bg-[#dbeafe]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>),
  },
  project: {
    label: "Project", cls: "text-[#ea580c]", box: "bg-[#ffedd5]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>),
  },
};

const AVATAR_TONES = [
  "bg-[#e8f1fe] text-[#1d6ce0]", "bg-[#fde6f2] text-[#c2185b]", "bg-[#e6f9ec] text-[#16a34a]",
  "bg-[#f1eafe] text-[#7c3aed]", "bg-[#feecdc] text-[#ea580c]", "bg-[#e0f2f1] text-[#00796b]",
];
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}
function toneOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const inputCls = "rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 shadow-[0_1px_3px_rgba(16,24,40,0.10)] outline-none focus:border-line focus:shadow-[0_2px_8px_rgba(16,24,40,0.12)]";
const feedbackHref = (s: QueueSubmission, state: "pending" | "graded") => {
  const from = state === "graded" ? "archive" : "submissions";
  return s.source === "exam"
    ? `/teacher/feedback/${s.testId}?source=exam&attempt=${s.id}&from=${from}`
    : `/teacher/feedback/${s.testId}?source=assignment&submission=${s.id}&from=${from}`;
};

export default function SubmissionQueue({ state, title, sub, emptyTitle, emptyBody }: {
  state: "pending" | "graded"; title: string; sub: string; emptyTitle: string; emptyBody: string;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<TypeFilter>("");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [items, setItems] = useState<QueueSubmission[]>([]);
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
      const data = await apiGet<QueueItemsPage>(`/api/v1/submission-queue/items${qs({
        page: p, limit: PAGE_SIZE, state, search: debounced || undefined,
        type: type || undefined, from,
      })}`);
      if (seq !== reqSeq.current) return;
      setTotal(data.total);
      setPage(p);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(e instanceof ApiError ? e.message : "Could not load submissions.");
    } finally {
      if (seq === reqSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [debounced, type, dateKey, state]);

  useEffect(() => { void fetchPage(1, false); }, [fetchPage, nonce]);

  const reset = () => {
    setSearch(""); setDebounced(""); setType(""); setDateKey("all");
    setNonce((n) => n + 1);
    toast("Filters reset — list refreshed.");
  };

  const hasMore = items.length < total;

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* header */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
          {state === "graded"
            ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></svg>
            : <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6" /><path d="m9.5 17 1.5 1.5 3-3" /></svg>}
        </span>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
          <p className="text-[15px] text-muted">{sub}</p>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-5" aria-label={title}>
        {/* filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="relative">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by test title or student name…"
                aria-label="Search by test title or student name" className={`${inputCls} w-full pl-9`} />
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">Test Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Test Type" className={`${inputCls} w-[170px] font-semibold`}>
              <option value="">All Types</option>
              <option value="written">Written</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">Date</span>
            <select value={dateKey} onChange={(e) => setDateKey(e.target.value as DateKey)} aria-label="Submission date" className={`${inputCls} w-[170px] font-semibold`}>
              <option value="all">All Time</option>
              <option value="today">Last 24 hours</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          </label>
          <button type="button" onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-[#1d6ce0] shadow-[0_1px_3px_rgba(16,24,40,0.10)] hover:bg-soft">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            Reset
          </button>
        </div>

        {/* table */}
        <div className="mt-4">
          {loading ? <Loading label="Loading submissions…" />
            : error ? <ErrorBox message={error} onRetry={() => setNonce((n) => n + 1)} />
            : !items.length ? <Empty title={emptyTitle} body={emptyBody} />
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="text-[13px] text-muted">
                        <th className="rounded-l-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">#</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Student</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Test</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Type</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Submitted</th>
                        <th className="rounded-r-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((s, i) => {
                        const meta = KIND_META[s.kind] ?? KIND_META.written!;
                        return (
                          <tr key={`${s.source}-${s.id}`} className="align-middle">
                            <td className="px-4 py-4 text-muted">{i + 1}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold ${toneOf(s.student.userId)}`}>
                                  {s.student.avatarUploadId ? (
                                    <AvatarImg uploadId={s.student.avatarUploadId} name={s.student.name} className="h-full w-full" />
                                  ) : (
                                    initialsOf(s.student.name)
                                  )}
                                </span>
                                <span>
                                  <span className="block font-semibold leading-tight">{s.student.name}</span>
                                  <span className="block max-w-[220px] truncate text-[13px] text-muted">{s.student.email || `id ${s.student.userId.slice(0, 8)}…`}</span>
                                </span>
                              </div>
                            </td>
                            <td className="max-w-[260px] px-4 py-4">
                              <p className="truncate font-bold">{s.testTitle}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {s.source === "exam" && s.attemptNumber != null ? `Attempt #${s.attemptNumber}` : "Project submission"}
                                {s.score != null && state === "graded" ? ` · Score ${s.score}` : ""}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <span className={`inline-flex items-center gap-2 font-medium ${meta.cls}`}>
                                <span aria-hidden className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.box}`}>{meta.icon}</span>
                                {meta.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-muted">{s.submittedAt ? fmtDate(s.submittedAt) : "—"}</td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <Link href={feedbackHref(s, state)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                                {state === "graded" ? "View Feedback" : "Give Feedback"}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* footer */}
                <div className="mt-4 rounded-xl border border-line bg-card px-4 py-4 text-center">
                  {loadingMore ? (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-[#1d6ce0]">
                      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d6ce0] border-t-transparent" />
                      Loading more submissions…
                    </p>
                  ) : hasMore ? (
                    <button type="button" onClick={() => void fetchPage(page + 1, true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d6ce0]">
                      Load more submissions…
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-muted">All submissions loaded</p>
                  )}
                  <p className="mt-1 text-[13px] text-muted">Showing {items.length} of {total} submissions</p>
                </div>
              </>
            )}
        </div>
      </section>
    </div>
  );
}
