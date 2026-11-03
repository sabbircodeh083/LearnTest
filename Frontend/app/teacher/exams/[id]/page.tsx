"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AvatarImg } from "@/components/profile";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { DataList, DataRow, RowIcon } from "@/components/DataList";
import { fmtDate, idOf, type Exam, type ExamAttemptRow, type Page, type Question } from "@/lib/types";

type Tab = "overview" | "questions" | "submissions";
type SortKey = "latest" | "oldest" | "highest" | "lowest";
type DateKey = "all" | "today" | "last7" | "last30";

/* ---------- small helpers ---------- */
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
function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "–";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return "–";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
function statusOf(state: string): { label: string; cls: string } {
  if (state === "graded") return { label: "Graded", cls: "bg-[#e6f9ec] text-[#16a34a]" };
  if (state === "submitted") return { label: "In Review", cls: "bg-[#fef3e2] text-[#d97706]" };
  return { label: "Not Submitted", cls: "bg-[#fee2e2] text-[#dc2626]" };
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

/* ---------- shared responsive list ---------- */
function AttemptTable({ rows, outOf, examId }: { rows: ExamAttemptRow[]; outOf: number; examId?: string }) {
  return (
    <DataList label="Attempts">
      {rows.map((a, i) => {
        const st = statusOf(a.state);
        return (
          <DataRow
            key={String((a as { _id?: string })._id ?? i)}
            icon={
              <RowIcon tone={toneOf(a.student.userId)} shape="rounded-full" size="h-9 w-9">
                {a.student.avatarUploadId ? (
                  <AvatarImg uploadId={a.student.avatarUploadId} name={a.student.name} className="h-full w-full" />
                ) : (
                  <span className="text-[13px] font-bold">{initialsOf(a.student.name)}</span>
                )}
              </RowIcon>
            }
            title={a.student.name}
            meta={<>{a.student.email || `id ${a.student.userId.slice(0, 8)}…`} · {fmtDateTime(a.submittedAt ?? a.createdAt)}</>}
            detail={<><Score score={a.state === "graded" ? a.score : null} outOf={outOf} /> · Time taken {a.state === "in_progress" ? "-" : fmtDuration(a.startedAt, a.submittedAt ?? a.createdAt)}</>}
            chip={<span className={`inline-flex items-center rounded-md px-3 py-1 text-[13px] font-semibold ${st.cls}`}>{st.label}</span>}
            actions={
              <>
                {examId ? (
                  <Link href={`/teacher/feedback/${examId}?source=exam&attempt=${String((a as { _id?: string })._id ?? "")}&from=test`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                    Give Feedback
                  </Link>
                ) : (
                  <button title="Submission review opens here soon" className="whitespace-nowrap rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-soft">
                    View Submission
                  </button>
                )}
                <button title="More actions soon" aria-label="More actions" className="rounded-lg p-2 text-muted hover:bg-soft">⋮</button>
              </>
            }
          />
        );
      })}
    </DataList>
  );
}

/* ---------- submissions tab (search + date + sort) ---------- */
function SubmissionsTab({ examId, outOf }: { examId: string; outOf: number }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  let from: string | undefined;
  const now = Date.now();
  if (dateKey === "today") from = new Date(now - 86400000).toISOString();
  if (dateKey === "last7") from = new Date(now - 7 * 86400000).toISOString();
  if (dateKey === "last30") from = new Date(now - 30 * 86400000).toISOString();

  const key = [examId, debounced, sort, dateKey, page].join("|");
  const data = useFetch(
    () => apiGet<Page<ExamAttemptRow>>(`/api/v1/exams/${examId}/attempts${qs({ search: debounced || undefined, sort, from, page, limit: 10, latest: 1, pendingOnly: 1 })}`),
    [key],
  );
  const total = data.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Student Submissions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Student Submissions</h2>
          <p className="mt-1 text-sm text-muted">Only each student&apos;s current pending submission appears here for feedback. Graded work moves to the Archive.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student name, email or submission ID..."
              aria-label="Search submissions by student name, email or submission ID"
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
        {data.loading ? <Loading label="Loading submissions…" />
          : data.error ? <ErrorBox message={data.error} onRetry={data.retry} />
          : !data.data?.items.length ? <Empty title="No submissions found" body={debounced || dateKey !== "all" ? "Nothing matches this search or date filter. Clear them to see everything." : "No student has attempted this test yet."} />
          : (
            <>
              <AttemptTable rows={data.data.items} outOf={outOf} examId={examId} />
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

/* ---------- questions tab ---------- */
const WRITTEN_TONE: Record<string, string> = {
  "Short Answer": "bg-[#dbeafe] text-[#1d6ce0]",
  "Long Answer": "bg-[#ede9fe] text-[#7c3aed]",
  Essay: "bg-[#ffedd5] text-[#c2410c]",
};
function QuestionsTab({ examId, qids, kind }: { examId: string; qids: string[]; kind?: string }) {
  void examId;
  const key = qids.join(",");
  const list = useFetch(async () => {
    if (!qids.length) return [] as Question[];
    const mine = await apiGet<Page<Question>>(`/api/v1/questions${qs({ mine: 1, limit: 100 })}`)
      .catch(() => ({ items: [], total: 0 }) as Page<Question>);
    const byId = new Map(mine.items.map((q) => [String(q._id), q]));
    const missing = qids.filter((id) => !byId.has(String(id))).slice(0, 50);
    for (const id of missing) {
      try {
        const one = await apiGet<Question>(`/api/v1/questions/${id}`);
        byId.set(String(one._id), one);
      } catch { /* removed or inaccessible — skipped */ }
    }
    return qids.map((id) => byId.get(String(id))).filter(Boolean) as Question[];
  }, [key]);

  const tone: Record<string, string> = { mcq: "bg-[#e6f9ec] text-[#16a34a]", short: "bg-[#e8f1fe] text-[#1d6ce0]", code: "bg-[#feecdc] text-[#ea580c]" };
  // Written tests store every question as backend type "short" with the specific
  // answer kind (Short/Long Answer, Essay) kept in the description — show that.
  const labelOf = (q: Question) =>
    kind === "written" && q.description ? q.description : q.type;
  const toneOf = (q: Question) =>
    kind === "written" && q.description ? (WRITTEN_TONE[q.description] ?? tone.short!) : (tone[q.type] ?? tone.short);
  // Title and prompt hold the same text (the teacher form copies text into
  // both), so showing both renders the question twice — hide the prompt line
  // when it duplicates the title.
  const sameText = (a: unknown, b: unknown) => {
    const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const x = norm(a), y = norm(b);
    return !!x && (x === y || (y.startsWith(x) && y.length - x.length < 10) || (x.startsWith(y) && x.length - y.length < 10));
  };
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Questions">
      <h2 className="text-xl font-bold tracking-tight">Questions</h2>
      <p className="mt-1 text-sm text-muted">{qids.length} question{qids.length === 1 ? "" : "s"} in this test, in order.</p>
      <div className="mt-4">
        {list.loading ? <Loading label="Loading questions…" />
          : list.error ? <ErrorBox message={list.error} onRetry={list.retry} />
          : !list.data?.length ? <Empty title="No questions linked" body="Edit this test and paste question IDs in order." />
          : (
            <ol className="divide-y divide-line">
              {list.data.map((q, i) => (
                <li key={idOf(q)} className="flex items-start gap-4 py-4">
                  <span className="w-5 shrink-0 pt-0.5 text-sm text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase ${toneOf(q)}`}>{labelOf(q)}</span>
                      <span className="truncate text-sm font-semibold">{q.title}</span>
                    </div>
                    {!sameText(q.prompt, q.title) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{q.prompt || q.description || "No prompt."}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
      </div>
    </section>
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

function OverviewTab({ rows, outOf, examId, kind }: { rows: ExamAttemptRow[]; outOf: number; examId: string; kind: string }) {
  const total = rows.length;
  const graded = rows.filter((a) => a.state === "graded");
  const inReview = rows.filter((a) => a.state === "submitted").length;
  const notSubmitted = rows.filter((a) => a.state === "in_progress").length;
  const scores = graded.map((a) => a.score ?? 0);
  const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  const avgPct = avg !== null && outOf ? Math.round((avg / outOf) * 100) : null;
  const buckets = [
    { label: "90–100", min: 90, cls: "bg-[#e6f9ec] text-[#15803d]", bar: "text-[#16a34a]" },
    { label: "70–89", min: 70, cls: "bg-[#e8f1fe] text-[#1d4ed8]", bar: "text-[#1d4ed8]" },
    { label: "50–69", min: 50, cls: "bg-[#fef3e2] text-[#b45309]", bar: "text-[#b45309]" },
    { label: "0–49", min: 0, cls: "bg-[#fee2e2] text-[#b91c1c]", bar: "text-[#b91c1c]" },
  ].map((b) => {
    const n = graded.filter((a) => (pctOf(a.score, outOf) ?? -1) >= b.min && (b.min === 90 || (pctOf(a.score, outOf) ?? 101) < b.min + (b.min === 70 ? 20 : b.min === 50 ? 20 : 50))).length;
    return { ...b, n, share: graded.length ? Math.round((n / graded.length) * 100) : 0 };
  });
  const hi = scores.length ? Math.max(...scores) : null;
  const lo = scores.length ? Math.min(...scores) : null;
  const recent = [...rows].filter((a) => a.state === "submitted").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3);

  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatMini label="Total Attempts" value={total.toLocaleString()}
          icon={miniIcon("bg-[#e6f9ec] text-[#16a34a]", <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></>)} />
        <StatMini label="Graded Submissions" value={graded.length.toLocaleString()}
          icon={miniIcon("bg-[#e8f1fe] text-[#2f80ed]", <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></>)} />
        <StatMini label="In Review" value={inReview.toLocaleString()}
          icon={miniIcon("bg-[#fef3e2] text-[#d97706]", <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)} />
        <StatMini label="Not Submitted" value={notSubmitted.toLocaleString()}
          icon={miniIcon("bg-[#fee2e2] text-[#dc2626]", <><path d="M7 7l10 10M17 7 7 17" /></>)} />
      </div>

      {kind !== "problem" && (
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
              <div className="flex gap-3"><dt className="text-muted">Questions</dt><dd className="font-bold">:</dd><dd className="font-bold text-[#1d4ed8]">{outOf || "—"}</dd></div>
            </dl>
          </div>
          <p className="mt-2 text-right text-xs text-muted">Based on {graded.length.toLocaleString()} graded submission{graded.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      )}

      {kind !== "quiz" && kind !== "problem" && (
      <section className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Recent Submissions">
        <h3 className="text-[17px] font-bold">Recent Submissions</h3>
        <p className="mt-0.5 text-sm text-muted">Latest student submissions for this test.</p>
        <div className="mt-3">
          {!recent.length ? <Empty title="No submissions yet" body="Submissions appear here once students submit this test." />
            : <AttemptTable rows={recent} outOf={outOf} examId={examId} />}
        </div>
      </section>
      )}
    </div>
  );
}

/* ---------- page ---------- */
const TAB_LABEL: Record<Tab, string> = { overview: "Overview", questions: "Questions", submissions: "Student Submissions" };

const TYPE_META: Record<string, { label: string; box: string; badge: string; icon: React.ReactNode }> = {
  quiz: {
    label: "Quiz", box: "bg-[#fce7f3] text-[#db2777]", badge: "bg-[#fce7f3] text-[#db2777]",
    icon: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /><path d="M9 7h6M9 17h4" /></>),
  },
  written: {
    label: "Written", box: "bg-[#dbeafe] text-[#2563eb]", badge: "bg-[#dbeafe] text-[#2563eb]",
    icon: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></>),
  },
  problem: {
    label: "Problem Solving", box: "bg-[#ede9fe] text-[#7c3aed]", badge: "bg-[#ede9fe] text-[#7c3aed]",
    icon: (<><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" /></>),
  },
  project: {
    label: "Project", box: "bg-[#ffedd5] text-[#ea580c]", badge: "bg-[#ffedd5] text-[#ea580c]",
    icon: (<><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  },
};

export default function TeacherExamDetailPage() {
  return (
    <Suspense fallback={<div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8"><Loading label="Loading test…" /></div>}>
      <TeacherExamDetailInner />
    </Suspense>
  );
}

function TeacherExamDetailInner() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id));
  const search = useSearchParams();
  const initialTab = search.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "submissions" || initialTab === "questions" || initialTab === "overview" ? initialTab : "overview",
  );

  const exam = useFetch(() => apiGet<Exam>(`/api/v1/exams/${id}`), [id]);
  const attempts = useFetch(() => apiGet<Page<ExamAttemptRow>>(`/api/v1/exams/${id}/attempts${qs({ limit: 100 })}`), [id]);
  const qids = exam.data?.questionIds ?? [];
  const outOf = qids.length;

  const e = exam.data;
  const total = attempts.data?.total ?? 0;
  const typeKey = (e as { kind?: string } | undefined)?.kind ?? "quiz";
  const typeMeta = TYPE_META[typeKey] ?? TYPE_META.quiz!;
  // Problem tests are practice-only (no submissions): no Submissions tab and
  // no submission/grade blocks on the overview. Project tests have no
  // Questions section.
  const visibleTabs: Tab[] =
    typeKey === "project" ? ["overview", "submissions"]
    : typeKey === "problem" ? ["overview", "questions"]
    : ["overview", "questions", "submissions"];
  const activeTab: Tab = visibleTabs.includes(tab) ? tab : "overview";

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* breadcrumb + date */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href="/teacher/exams" className="text-muted hover:text-ink">‹ All Tests</Link>
          <span aria-hidden className="text-muted">›</span>
          <span className="text-muted">{e?.title ?? "…"}</span>
          <span aria-hidden className="text-muted">›</span>
          <span aria-current="page" className="font-semibold">{TAB_LABEL[activeTab]}</span>
        </nav>
        <button className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium shadow-sm" aria-label="Date range (visual only)">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
          <span>Oct 1, 2024 - Oct 26, 2024</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      {exam.loading ? <div className="mt-6"><Loading label="Loading test…" /></div>
        : exam.error || !e ? <div className="mt-6"><ErrorBox message={exam.error ?? "Test not found."} onRetry={exam.retry} /></div>
        : (
          <>
            {/* header card */}
            <section className="mt-4 flex flex-col gap-5 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6 lg:flex-row lg:items-center" aria-label="Test summary">
              <span aria-hidden className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl ${typeMeta.box}`}>
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{typeMeta.icon}</svg>
              </span>
              <div className="min-w-0 flex-1">
                <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[13px] font-semibold ${typeMeta.badge}`}>
                  {typeMeta.label}
                </span>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{e.title}</h1>
                <p className="mt-0.5 text-sm text-muted">{e.description || "No description."}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.3a2.5 2.5 0 1 1 3.4 2.4c-.8.3-.9 1-.9 1.6" /><circle cx="12" cy="16.5" r="0.5" fill="currentColor" /></svg>
                    {outOf} questions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                    {e.durationMinutes} minutes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 20V12M10 20V6M16 20v-9M21 20H3" /></svg>
                    max {e.maxAttempts == null ? "No bound" : `${e.maxAttempts} attempt${e.maxAttempts === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
              <dl className="space-y-2 border-line text-sm lg:border-x lg:px-8">
                <div className="flex items-center gap-2"><dt className="sr-only">Rating</dt><dd aria-hidden className="text-[#f5a623]">★</dd><dd className="font-bold">—</dd><dd className="text-muted">(no ratings API)</dd></div>
                <div className="flex items-center gap-2 text-muted">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg>
                  <dd>{attempts.data ? `${total.toLocaleString()} attempts` : "…"}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                  <dd>Created on {fmtDate(e.createdAt)}</dd>
                </div>
              </dl>
              <Link href={`/teacher/exams/${id}/edit`} className="shrink-0 rounded-lg border border-[#16a34a] px-8 py-2.5 text-sm font-semibold text-[#16a34a] hover:bg-[#e6f9ec]">
                Edit Test
              </Link>
            </section>

            {/* tabs — project tests have no Questions section, problem tests (practice-only) have no Submissions */}
            {(() => {
              return (
                <>
                  <div className="mt-4 flex gap-8 rounded-xl border border-line bg-card px-6 pt-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]" role="tablist" aria-label="Test sections">
                    {visibleTabs.map((t) => (
                      <button key={t} role="tab" aria-selected={activeTab === t} onClick={() => setTab(t)}
                        className={`pb-3 text-[15px] font-medium ${activeTab === t ? "rounded-t-lg bg-[#e6f9ec] px-6 font-semibold text-[#16a34a] shadow-[inset_0_-2px_0_#16a34a]" : "px-2 text-muted hover:text-ink"}`}>
                        {t === "overview" ? "Overview" : t === "questions" ? "Questions" : "Submissions"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    {attempts.loading ? <Loading label="Loading attempts…" />
                      : attempts.error ? <ErrorBox message={attempts.error} onRetry={attempts.retry} />
                      : activeTab === "overview" ? <OverviewTab rows={attempts.data?.items ?? []} outOf={outOf} examId={id} kind={typeKey} />
                      : activeTab === "questions" ? <QuestionsTab examId={id} qids={qids} kind={typeKey} />
                      : <SubmissionsTab examId={id} outOf={outOf} />}
                  </div>
                </>
              );
            })()}
          </>
        )}
    </div>
  );
}
