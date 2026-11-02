"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Empty, ErrorBox, inputCls, Loading, useToast } from "@/components/ui";
import { apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Assignment, type Page, type Submission } from "@/lib/types";

type Tab = "overview" | "questions" | "submissions";
type SortKey = "latest" | "oldest" | "highest" | "lowest";
type DateKey = "all" | "today" | "last7" | "last30";

/* ---------- small helpers (same look as /teacher/exams/[id]) ---------- */
const AVATAR_TONES = [
  "bg-[#e8f1fe] text-[#1d6ce0]", "bg-[#fde6f2] text-[#c2185b]", "bg-[#e6f9ec] text-[#16a34a]",
  "bg-[#f1eafe] text-[#7c3aed]", "bg-[#feecdc] text-[#ea580c]", "bg-[#e0f2f1] text-[#00796b]",
];
function toneOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function statusOf(state: string): { label: string; cls: string } {
  if (state === "graded") return { label: "Graded", cls: "bg-[#e6f9ec] text-[#16a34a]" };
  if (state === "submitted" || state === "under_review") return { label: "In Review", cls: "bg-[#fef3e2] text-[#d97706]" };
  if (state === "returned") return { label: "Returned", cls: "bg-soft text-muted" };
  return { label: state.replace(/_/g, " "), cls: "bg-soft text-muted" };
}
function Score({ score, outOf }: { score: number | null; outOf: number }) {
  if (score === null || score === undefined) return <span className="text-muted">-</span>;
  if (!outOf) return <span className="font-semibold">{score} pts</span>;
  const pct = Math.round((score / outOf) * 100);
  const cls = pct >= 80 ? "text-[#16a34a]" : pct >= 60 ? "text-[#d97706]" : "text-[#dc2626]";
  return <span className={`font-semibold ${cls}`}>{score} / {outOf} <span className="font-medium">({pct}%)</span></span>;
}
function pctOf(score: number | null, outOf: number): number | null {
  if (score === null || score === undefined || !outOf) return null;
  return Math.round((score / outOf) * 100);
}

/* ---------- shared table ---------- */
function SubmissionTable({ rows, outOf, start, renderActions }: {
  rows: Submission[]; outOf: number; start: number;
  renderActions?: (s: Submission) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="text-[13px] text-muted">
            <th className="rounded-l-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">#</th>
            <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Student</th>
            <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Score</th>
            <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Submitted At</th>
            <th className="bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Status</th>
            <th className="rounded-r-lg bg-[#f4f6fb] px-4 py-2.5 font-medium dark:bg-soft">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((s, i) => {
            const st = statusOf(s.state);
            const short = String(s.studentId).slice(0, 8);
            return (
              <tr key={String(s._id ?? i)} className="align-middle">
                <td className="px-4 py-4 text-muted">{start + i + 1}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${toneOf(String(s.studentId))}`}>
                      {short.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <span className="block font-semibold leading-tight">Student {short}…</span>
                      <span className="block max-w-[280px] truncate text-[13px] text-muted">
                        {[s.repoUrl && "Git link", s.liveUrl && "Live link", s.uploadId && "File attached"].filter(Boolean).join(" · ") || "No links yet"}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4"><Score score={s.state === "graded" ? s.grade : null} outOf={outOf} /></td>
                <td className="whitespace-nowrap px-4 py-4 text-muted">{fmtDateTime(s.createdAt)}</td>
                <td className="px-4 py-4"><span className={`inline-flex items-center rounded-md px-3 py-1 text-[13px] font-semibold ${st.cls}`}>{st.label}</span></td>
                <td className="px-4 py-4">{renderActions ? renderActions(s) : <span className="text-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- overview tab ---------- */
function StatMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      {icon}
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-[26px] font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

function miniIcon(bg: string, path: React.ReactNode) {
  return (
    <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </span>
  );
}

function OverviewTab({ rows, outOf }: { rows: Submission[]; outOf: number }) {
  const total = rows.length;
  const graded = rows.filter((s) => s.state === "graded");
  const inReview = rows.filter((s) => s.state === "submitted" || s.state === "under_review").length;
  const returned = rows.filter((s) => s.state === "returned").length;
  const scores = graded.map((s) => s.grade ?? 0);
  const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  const avgPct = avg !== null && outOf ? Math.round((avg / outOf) * 100) : null;
  const buckets = [
    { label: "90–100", min: 90, cls: "bg-[#e6f9ec] text-[#15803d]", bar: "text-[#16a34a]" },
    { label: "70–89", min: 70, cls: "bg-[#e8f1fe] text-[#1d4ed8]", bar: "text-[#1d4ed8]" },
    { label: "50–69", min: 50, cls: "bg-[#fef3e2] text-[#b45309]", bar: "text-[#b45309]" },
    { label: "0–49", min: 0, cls: "bg-[#fee2e2] text-[#b91c1c]", bar: "text-[#b91c1c]" },
  ].map((b) => {
    const n = graded.filter((s) => (pctOf(s.grade, outOf) ?? -1) >= b.min && (b.min === 90 || (pctOf(s.grade, outOf) ?? 101) < b.min + (b.min === 70 ? 20 : b.min === 50 ? 20 : 50))).length;
    return { ...b, n, share: graded.length ? Math.round((n / graded.length) * 100) : 0 };
  });
  const hi = scores.length ? Math.max(...scores) : null;
  const lo = scores.length ? Math.min(...scores) : null;
  const recent = [...rows].filter((s) => s.state !== "graded").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3);

  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatMini label="Total Submissions" value={total.toLocaleString()}
          icon={miniIcon("bg-[#e6f9ec] text-[#16a34a]", <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></>)} />
        <StatMini label="Graded Submissions" value={graded.length.toLocaleString()}
          icon={miniIcon("bg-[#e8f1fe] text-[#2f80ed]", <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></>)} />
        <StatMini label="In Review" value={inReview.toLocaleString()}
          icon={miniIcon("bg-[#fef3e2] text-[#d97706]", <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)} />
        <StatMini label="Returned" value={returned.toLocaleString()}
          icon={miniIcon("bg-[#fee2e2] text-[#dc2626]", <><path d="M7 7l10 10M17 7 7 17" /></>)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] lg:col-span-3">
          <h3 className="text-[17px] font-bold">Score Distribution</h3>
          {graded.length && outOf ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {buckets.map((b, i) => (
                <div key={b.label} className={`rounded-lg p-3 ${b.cls}`}>
                  <p className="text-[13px]"><span className="mr-1.5 font-bold opacity-60">{i + 1}.</span>{b.label}</p>
                  <p className={`text-xl font-bold ${b.bar}`}>{b.share}%</p>
                  <p className="mt-0.5 text-[13px]">({b.n} student{b.n === 1 ? "" : "s"})</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No graded submissions yet — distribution appears here once you grade.</p>
          )}
        </div>
        <div className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] lg:col-span-2">
          <h3 className="text-[17px] font-bold">Average Score</h3>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <div className="relative h-[104px] w-[104px]" role="img" aria-label={avgPct !== null ? `Average score ${avgPct} percent` : "No average yet"}>
              <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
                <circle cx="52" cy="52" r={R} fill="none" strokeWidth="11" className="stroke-line" stroke="currentColor" opacity={0.12} />
                <circle cx="52" cy="52" r={R} fill="none" stroke="#22c55e" strokeWidth="11" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C - (C * (avgPct ?? 0)) / 100} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{avgPct !== null ? `${avgPct}%` : "—"}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-3"><dt className="text-muted">Highest Score</dt><dd className="font-bold">:</dd><dd className="font-bold text-[#1d4ed8]">{hi !== null && outOf ? `${hi}/${outOf}` : "—"}</dd></div>
              <div className="flex gap-3"><dt className="text-muted">Lowest Score</dt><dd className="font-bold">:</dd><dd className="font-bold text-[#1d4ed8]">{lo !== null && outOf ? `${lo}/${outOf}` : "—"}</dd></div>
              <div className="flex gap-3"><dt className="text-muted">Max Score</dt><dd className="font-bold">:</dd><dd className="font-bold text-[#1d4ed8]">{outOf || "—"}</dd></div>
            </dl>
          </div>
          <p className="mt-2 text-right text-xs text-muted">Based on {graded.length.toLocaleString()} graded submission{graded.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Recent Submissions">
        <h3 className="text-[17px] font-bold">Recent Submissions</h3>
        <p className="mt-0.5 text-sm text-muted">Latest student submissions for this project.</p>
        <div className="mt-3">
          {!recent.length ? <Empty title="No submissions yet" body="Submissions appear here as soon as students submit to this project." />
            : <SubmissionTable rows={recent} outOf={outOf} start={0} />}
        </div>
      </section>
    </div>
  );
}

/* ---------- questions tab (project requirements) ---------- */
function QuestionsTab({ project }: { project: Assignment }) {
  const slots = [
    { label: "Git Repository Link", body: "Students paste their public GitHub, GitLab or Bitbucket URL." },
    { label: "Live Link", body: "Students paste their deployed live project URL." },
    { label: "File Upload (PDF / ZIP)", body: "Students attach their report or compressed project folder." },
  ];
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Questions">
      <h2 className="text-xl font-bold tracking-tight">Questions</h2>
      <p className="mt-1 text-sm text-muted">What students must submit for this project, in order.</p>
      <ol className="mt-4 divide-y divide-line">
        {slots.map((s, i) => (
          <li key={s.label} className="flex items-start gap-4 py-4">
            <span className="w-5 shrink-0 pt-0.5 text-sm text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-[#ffedd5] px-2.5 py-0.5 text-xs font-semibold uppercase text-[#ea580c]">submission</span>
                <span className="truncate text-sm font-semibold">{s.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-lg border border-line bg-soft p-4">
        <p className="text-sm font-bold">Project instructions</p>
        <p className="mt-1 whitespace-pre-line text-sm text-muted">{project.description || "No description."}</p>
      </div>
    </section>
  );
}

/* ---------- submissions tab (search + date + sort + inline grading) ---------- */
function SubmissionsTab({ assignmentId, outOf, rows, loading, error, onRetry, onGraded }: {
  assignmentId: string; outOf: number; rows: Submission[];
  loading: boolean; error: string | null; onRetry: () => void; onGraded: () => void;
}) {
  void assignmentId;
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [page, setPage] = useState(1);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim().toLowerCase()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const from = dateKey === "today" ? now - 86400000 : dateKey === "last7" ? now - 7 * 86400000 : dateKey === "last30" ? now - 30 * 86400000 : 0;
    // Graded submissions live only in the Archive — this table is pending work.
    let list = rows.filter((s) => s.state !== "graded").filter((s) => {
      if (from && +new Date(s.createdAt) < from) return false;
      if (!debounced) return true;
      return [s.studentId, s.repoUrl, s.liveUrl, s.uploadId, s._id].filter(Boolean).join(" ").toLowerCase().includes(debounced);
    });
    list = [...list].sort((a, b) => {
      if (sort === "oldest") return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === "highest") return (b.grade ?? -1) - (a.grade ?? -1);
      if (sort === "lowest") return (a.grade ?? Number.MAX_SAFE_INTEGER) - (b.grade ?? Number.MAX_SAFE_INTEGER);
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return list;
  }, [rows, debounced, sort, dateKey]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / 10));
  const pageRows = filtered.slice((page - 1) * 10, page * 10);

  const saveGrade = async (s: Submission) => {
    const g = grades[s._id];
    if (!g?.grade) { toast("Enter a grade first.", "err"); return; }
    if (Number(g.grade) > outOf) { toast(`Grade cannot exceed max score (${outOf}).`, "err"); return; }
    setBusyId(s._id);
    try {
      await apiPatch(`/api/v1/submissions/${s._id}/grade`, { grade: Number(g.grade), feedback: g.feedback ?? "" });
      toast("Submission graded.");
      onGraded();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not grade.", "err"); }
    finally { setBusyId(null); }
  };

  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Student Submissions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Student Submissions</h2>
          <p className="mt-1 text-sm text-muted">Only pending submissions appear here. Graded work moves to the Archive.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student, link or submission ID..."
              aria-label="Search submissions by student, link or submission ID"
              className="w-72 max-w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm placeholder:text-muted/70 focus:border-brand sm:w-96" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Sort by</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              aria-label="Sort submissions"
              className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-medium">
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Score</option>
              <option value="lowest">Lowest Score</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Date</span>
            <select value={dateKey} onChange={(e) => { setDateKey(e.target.value as DateKey); setPage(1); }}
              aria-label="Filter submissions by date"
              className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-medium">
              <option value="all">All dates</option>
              <option value="today">Last 24 hours</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4">
        {loading ? <Loading label="Loading submissions…" />
          : error ? <ErrorBox message={error} onRetry={onRetry} />
          : !filtered.length ? <Empty title="No submissions found" body={debounced || dateKey !== "all" ? "Nothing matches this search or date filter. Clear them to see everything." : "No student has submitted to this project yet."} />
          : (
            <>
              <SubmissionTable rows={pageRows} outOf={outOf} start={(page - 1) * 10} renderActions={(s) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => setGradingId((g) => (g === s._id ? null : s._id))}
                    className="whitespace-nowrap rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-soft">
                    {gradingId === s._id ? "Close" : s.state === "graded" ? "Edit Grade" : "Grade"}
                  </button>
                </div>
              )} />
              {pageRows.map((s) => gradingId !== s._id ? null : (
                <div key={`grade-${s._id}`} className="rounded-xl border border-line bg-soft p-4">
                  {(s.repoUrl || s.liveUrl || s.uploadId) && (
                    <div className="space-y-1 text-sm">
                      {s.repoUrl && <p className="break-all">Git: <a className="text-[#1d6ce0] underline" href={s.repoUrl} target="_blank" rel="noreferrer">{s.repoUrl}</a></p>}
                      {s.liveUrl && <p className="break-all">Live: <a className="text-[#1d6ce0] underline" href={s.liveUrl} target="_blank" rel="noreferrer">{s.liveUrl}</a></p>}
                      {s.uploadId && <p className="text-muted">Uploaded file ID: {s.uploadId}</p>}
                    </div>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">Grade (max {outOf})</span>
                      <input type="number" min={0} max={outOf} className={inputCls}
                        value={grades[s._id]?.grade ?? (s.grade ?? "")}
                        onChange={(e) => setGrades((g) => ({ ...g, [s._id]: { grade: e.target.value, feedback: g[s._id]?.feedback ?? s.feedback ?? "" } }))} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">Feedback</span>
                      <input className={inputCls}
                        value={grades[s._id]?.feedback ?? s.feedback ?? ""}
                        onChange={(e) => setGrades((g) => ({ ...g, [s._id]: { grade: g[s._id]?.grade ?? String(s.grade ?? ""), feedback: e.target.value } }))} />
                    </label>
                    <button onClick={() => void saveGrade(s)} disabled={busyId === s._id}
                      className="rounded-lg bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50">
                      {busyId === s._id ? "Saving…" : "Save grade"}
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <p>{total} submission{total === 1 ? "" : "s"} · page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-line px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
                  <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="rounded-lg border border-line px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          )}
      </div>
    </section>
  );
}

/* ---------- page ---------- */
const TAB_LABEL: Record<Tab, string> = { overview: "Overview", questions: "Questions", submissions: "Student Submissions" };

export default function TeacherProjectDetailsPage() {
  return (
    <Suspense fallback={<div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8"><Loading label="Loading project…" /></div>}>
      <TeacherProjectDetailsInner />
    </Suspense>
  );
}

function TeacherProjectDetailsInner() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id));
  const search = useSearchParams();
  const initialTab = search.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "submissions" || initialTab === "questions" || initialTab === "overview" ? initialTab : "overview",
  );

  const project = useFetch(() => apiGet<Assignment>(`/api/v1/assignments/${id}`), [id]);
  const subs = useFetch(() => apiGet<Page<Submission>>(`/api/v1/assignments/${id}/submissions${qs({ limit: 100, latest: 1 })}`), [id]);
  const rows = subs.data?.items ?? [];
  const outOf = project.data?.maxScore ?? 0;

  const a = project.data;
  const total = subs.data?.total ?? 0;

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* breadcrumb + date */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href="/teacher/exams" className="text-muted hover:text-ink">‹ All Tests</Link>
          <span aria-hidden className="text-muted">›</span>
          <span className="text-muted">{a?.title ?? "…"}</span>
          <span aria-hidden className="text-muted">›</span>
          <span aria-current="page" className="font-semibold">{TAB_LABEL[tab === "questions" ? "overview" : tab]}</span>
        </nav>
        <button className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium shadow-sm" aria-label="Date range (visual only)">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
          <span>Oct 1, 2024 - Oct 26, 2024</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      {project.loading ? <div className="mt-6"><Loading label="Loading project…" /></div>
        : project.error || !a ? <div className="mt-6"><ErrorBox message={project.error ?? "Project not found."} onRetry={project.retry} /></div>
        : (
          <>
            {/* header card */}
            <section className="mt-4 flex flex-col gap-5 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6 lg:flex-row lg:items-center" aria-label="Test summary">
              <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#ffedd5] text-[#ea580c]">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-md bg-[#ffedd5] px-2.5 py-0.5 text-[13px] font-semibold text-[#ea580c]">
                  Project
                </span>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{a.title}</h1>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.description || "No description."}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.3a2.5 2.5 0 1 1 3.4 2.4c-.8.3-.9 1-.9 1.6" /><circle cx="12" cy="16.5" r="0.5" fill="currentColor" /></svg>
                    Max score {a.maxScore}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                    {a.dueAt ? fmtDateTime(a.dueAt) : "No deadline"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 20V12M10 20V6M16 20v-9M21 20H3" /></svg>
                    {a.price > 0 ? `${a.price} ${a.currency}` : "Free"}
                  </span>
                </div>
              </div>
              <dl className="space-y-2 border-line text-sm lg:border-x lg:px-8">
                <div className="flex items-center gap-2"><dt className="sr-only">Rating</dt><dd aria-hidden className="text-[#f5a623]">★</dd><dd className="font-bold">—</dd><dd className="text-muted">(no ratings API)</dd></div>
                <div className="flex items-center gap-2 text-muted">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg>
                  <dd>{subs.data ? `${total.toLocaleString()} submissions` : "…"}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                  <dd>Created on {fmtDate(a.createdAt)}</dd>
                </div>
              </dl>
              <Link href={`/teacher/exams/${id}/edit`} className="shrink-0 rounded-lg border border-[#16a34a] px-8 py-2.5 text-sm font-semibold text-[#16a34a] hover:bg-[#e6f9ec]">
                Edit Test
              </Link>
            </section>

            {/* tabs — project tests have no Questions section */}
            {(() => {
              const activeTab: Tab = tab === "questions" ? "overview" : tab;
              return (
                <>
                  <div className="mt-4 flex gap-8 rounded-xl border border-line bg-card px-6 pt-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]" role="tablist" aria-label="Test sections">
                    {(["overview", "submissions"] as Tab[]).map((t) => (
                      <button key={t} role="tab" aria-selected={activeTab === t} onClick={() => setTab(t)}
                        className={`pb-3 text-[15px] font-medium ${activeTab === t ? "rounded-t-lg bg-[#e6f9ec] px-6 font-semibold text-[#16a34a] shadow-[inset_0_-2px_0_#16a34a]" : "px-2 text-muted hover:text-ink"}`}>
                        {t === "overview" ? "Overview" : "Submissions"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    {subs.loading ? <Loading label="Loading submissions…" />
                      : subs.error ? <ErrorBox message={subs.error} onRetry={subs.retry} />
                      : activeTab === "overview" ? <OverviewTab rows={rows} outOf={outOf} />
                      : <SubmissionsTab assignmentId={id} outOf={outOf} rows={rows} loading={subs.loading} error={subs.error} onRetry={subs.retry} onGraded={subs.retry} />}
                  </div>
                </>
              );
            })()}
          </>
        )}
    </div>
  );
}
