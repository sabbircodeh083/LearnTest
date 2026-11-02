"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { apiDelete, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { fmtDate, type MyTest, type MyTestPage, type TestKind } from "@/lib/types";

const PAGE_SIZE = 20;
type Tab = "all" | "published" | "drafts" | "archived";

const KIND_META: Record<TestKind, { label: string; cls: string; icon: React.ReactNode }> = {
  quiz: {
    label: "Quiz", cls: "text-[#db2777]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>),
  },
  written: {
    label: "Written", cls: "text-[#2563eb]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>),
  },
  problem: {
    label: "Problem Solving", cls: "text-[#7c3aed]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" /></svg>),
  },
  project: {
    label: "Project", cls: "text-[#ea580c]",
    icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>),
  },
};
const KIND_BG: Record<TestKind, string> = {
  quiz: "bg-[#fce7f3]", written: "bg-[#dbeafe]", problem: "bg-[#ede9fe]", project: "bg-[#ffedd5]",
};

const inputCls = "rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand";

function BackToProfile() {
  const sp = useSearchParams();
  if (sp.get("from") !== "profile") return null;
  return (
    <Link href="/teacher/profile" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back to Profile</Link>
  );
}
const detailsHref = (t: MyTest) => (t.source === "exam" ? `/teacher/exams/${t._id}` : `/teacher/assignments/${t._id}`);
const endpointOf = (t: MyTest) => (t.source === "exam" ? `/api/v1/exams/${t._id}` : `/api/v1/assignments/${t._id}`);

export default function AllTestsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<"" | TestKind>("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<MyTest[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, published: 0, drafts: 0, archived: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const data = await apiGet<MyTestPage>(`/api/v1/my-tests${qs({
        page: p, limit: PAGE_SIZE, search: debounced || undefined,
        type: type || undefined, status: status || undefined, tab,
      })}`);
      if (seq !== reqSeq.current) return;
      setTotal(data.total);
      setCounts(data.counts);
      setPage(p);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(e instanceof ApiError ? e.message : "Could not load your tests.");
    } finally {
      if (seq === reqSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [debounced, type, status, tab]);

  // Refetch from page 1 whenever filters/tab/search change or Reset bumps nonce.
  useEffect(() => { void fetchPage(1, false); }, [fetchPage, nonce]);

  const reset = () => {
    setSearch(""); setDebounced(""); setType(""); setStatus(""); setTab("all"); setMenuId(null);
    setNonce((n) => n + 1); // refetch fresh (updated) tests
    toast("Filters reset — tests refreshed.");
  };

  const toggleStatus = async (t: MyTest) => {
    const next = t.status === "published" ? "draft" : "published";
    setBusyId(t._id); setMenuId(null);
    try {
      await apiPatch(endpointOf(t), { status: next });
      toast(next === "published" ? "Test published." : "Test moved to draft.");
      void fetchPage(1, false);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not change status.", "err"); }
    finally { setBusyId(null); }
  };

  const hardDelete = async (t: MyTest) => {
    setMenuId(null);
    if (!window.confirm(`Hard delete "${t.title}"?\n\nThis permanently deletes the test${t.source === "exam" ? " and its questions (when not used by another test)" : " and its submissions"}. This cannot be undone.`)) return;
    setBusyId(t._id);
    try {
      await apiDelete(endpointOf(t));
      toast("Test permanently deleted.");
      void fetchPage(1, false);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not delete.", "err"); }
    finally { setBusyId(null); }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Tests", count: counts.all },
    { key: "published", label: "Published", count: counts.published },
    { key: "drafts", label: "Drafts", count: counts.drafts },
    { key: "archived", label: "Archived", count: counts.archived },
  ];
  const hasMore = items.length < total;

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Suspense>
        <BackToProfile />
      </Suspense>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>
          </span>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">All Tests</h1>
            <p className="text-[15px] text-muted">Manage and view all your created tests.</p>
          </div>
        </div>
        <Link href="/teacher/exams/new" className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#15803d]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Create Test
        </Link>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-5" aria-label="All Tests">
        {/* tabs */}
        <div className="flex flex-wrap gap-6 border-b border-line" role="tablist" aria-label="Test buckets">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-1 pb-2.5 text-[15px] font-medium ${tab === t.key ? "border-[#16a34a] font-semibold text-[#16a34a]" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* filters */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or description…"
              aria-label="Search by title or description" className={`${inputCls} w-full pl-9`} />
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">Test Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as "" | TestKind)} aria-label="Test Type" className={`${inputCls} w-[170px]`}>
              <option value="">All Types</option>
              <option value="quiz">Quiz</option>
              <option value="written">Written</option>
              <option value="problem">Problem Solving</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${inputCls} w-[160px]`}>
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <button type="button" onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-[#1d6ce0] hover:bg-soft">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            Reset
          </button>
        </div>
        <p className="mt-2 text-[13px] text-muted">You can search using test title or paste a YouTube video ID (e.g. dQw4w9WgXcQ). Newest tests appear first.</p>

        {/* table */}
        <div className="mt-4">
          {loading ? <Loading label="Loading tests…" />
            : error ? <ErrorBox message={error} onRetry={() => void fetchPage(1, false)} />
            : !items.length ? <Empty title="No tests found" body="Nothing matches these filters. Reset them, or create your first test." action={<Link href="/teacher/exams/new" className="inline-flex rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white">Create Test</Link>} />
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="text-[13px] text-muted">
                        <th className="rounded-l-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">#</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Test Title</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Type</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Price</th>
                        <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Status</th>
                        <th className="rounded-r-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((t, i) => {
                        const meta = KIND_META[t.kind];
                        const bucketLabel = t.archived ? "Archived" : t.status === "published" ? "Published" : t.status === "draft" ? "Draft" : t.status;
                        return (
                          <tr key={`${t.source}-${t._id}`} className="align-middle">
                            <td className="px-4 py-4 text-muted">{i + 1}</td>
                            <td className="max-w-[340px] px-4 py-4">
                              <p className="truncate font-bold">{t.title}</p>
                              <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{t.description || "No description."}</p>
                              <p className="mt-0.5 text-xs text-muted">{fmtDate(t.createdAt)}{t.deadline ? ` · Deadline ${fmtDate(t.deadline)}` : ""}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <span className={`inline-flex items-center gap-2 font-medium ${meta.cls}`}>
                                <span aria-hidden className={`flex h-8 w-8 items-center justify-center rounded-lg ${KIND_BG[t.kind]}`}>{meta.icon}</span>
                                {meta.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              {t.price > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] px-2.5 py-1 text-[13px] font-bold text-[#16a34a]">
                                  ৳ {Number(t.price).toLocaleString()}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md bg-soft px-2.5 py-1 text-[13px] font-semibold text-muted">Free</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <span className={`inline-flex rounded-md px-2.5 py-1 text-[13px] font-semibold ${bucketLabel === "Published" ? "bg-[#dcfce7] text-[#16a34a]" : bucketLabel === "Archived" ? "bg-[#fef3e2] text-[#b45309]" : "bg-soft text-muted"}`}>
                                {bucketLabel}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <div className="relative flex items-center gap-1">
                                <Link href={detailsHref(t)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                                  View Details
                                </Link>
                                <button type="button" aria-label={`More actions for ${t.title}`} aria-expanded={menuId === t._id}
                                  disabled={busyId === t._id}
                                  onClick={(e) => {
                                    if (menuId === t._id) { setMenuId(null); return; }
                                    // Fixed positioning escapes the table's scroll container, and the
                                    // menu flips upward when there is no room below (last rows).
                                    const r = e.currentTarget.getBoundingClientRect();
                                    const up = window.innerHeight - r.bottom < 190;
                                    setMenuPos(up
                                      ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
                                      : { top: r.bottom + 4, right: window.innerWidth - r.right });
                                    setMenuId(t._id);
                                  }}
                                  className="rounded-lg p-2 text-muted hover:bg-soft disabled:opacity-50">⋮</button>
                                {menuId === t._id && (
                                  <>
                                    <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} />
                                    <div className="fixed z-20 mt-1 w-48 rounded-xl border border-line bg-card py-1.5 shadow-lg" style={menuPos ?? undefined} role="menu" aria-label={`Actions for ${t.title}`}>
                                      <Link role="menuitem" href={`/teacher/exams/${t._id}/edit`} onClick={() => setMenuId(null)}
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-soft">
                                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                                        Edit
                                      </Link>
                                      <button type="button" role="menuitem" onClick={() => void toggleStatus(t)}
                                        className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium hover:bg-soft ${t.status === "published" ? "text-[#b45309]" : "text-[#16a34a]"}`}>
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                                        {t.status === "published" ? "Draft" : "Publish"}
                                      </button>
                                      <button type="button" role="menuitem" onClick={() => void hardDelete(t)}
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-[#dc2626] hover:bg-[#fee2e2]">
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" /></svg>
                                        Hard Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* pagination: fetch 20 at a time */}
                <div className="mt-4 rounded-xl border border-line bg-card px-4 py-4 text-center">
                  {hasMore ? (
                    <button type="button" disabled={loadingMore} onClick={() => void fetchPage(page + 1, true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d6ce0] disabled:opacity-60">
                      {loadingMore && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d6ce0] border-t-transparent" />}
                      {loadingMore ? "Loading more tests…" : "Load more tests…"}
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-muted">All tests loaded</p>
                  )}
                  <p className="mt-1 text-[13px] text-muted">Showing {items.length} of {total} tests</p>
                </div>
              </>
            )}
        </div>
      </section>
    </div>
  );
}
