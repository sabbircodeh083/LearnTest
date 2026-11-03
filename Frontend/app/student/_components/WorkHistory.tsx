"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, PageHead, statusTone } from "@/components/ui";
import { DataList, RowChip, RowIcon, SearchField } from "@/components/DataList";
import { apiGet, qs } from "@/lib/api";
import { useFetch, useDebouncedValue } from "@/lib/hooks";
import { fmtDate, type Exam, type ExamAttempt, type Page } from "@/lib/types";

export type WorkHistoryMode = "pending" | "graded";

interface Row {
  id: string;
  date: string;
  title: string;
  kind: string;
  kindKey: string;
  state: string;
  score: number | null;
  feedback: string;
  href: string;
}

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", written: "Written", problem: "Problem", project: "Project" };
const KIND_BADGE: Record<string, string> = {
  Quiz: "bg-[#e6f9ec] text-[#16a34a]",
  Written: "bg-[#e8f1fe] text-[#1d6ce0]",
  Problem: "bg-[#ede9fe] text-[#7c3aed]",
  Project: "bg-[#ffedd5] text-[#c2410c]",
  Test: "bg-soft text-muted",
};
const KIND_BOX: Record<string, string> = {
  Quiz: "bg-[#e6f9ec] text-[#16a34a]",
  Written: "bg-[#e8f1fe] text-[#1d6ce0]",
  Problem: "bg-[#ede9fe] text-[#7c3aed]",
  Project: "bg-[#ffedd5] text-[#ea580c]",
  Test: "bg-soft text-muted",
};

const COPY: Record<WorkHistoryMode, {
  title: string; sub: string; searchId: string; searchLabel: string;
  loading: string; emptyTitle: string; emptyBody: string; noMatchBody: string;
  dateVerb: string; showScore: boolean; hrefSuffix: string;
}> = {
  pending: {
    title: "My Submissions", sub: "Your submitted work awaiting review. Graded work moves to Results & Feedback.",
    searchId: "submissions-search", searchLabel: "Search submissions by test title",
    loading: "Loading submissions…", emptyTitle: "No submissions yet",
    emptyBody: "Attempt a test and submit it to see your work here.",
    noMatchBody: "No submissions of this type yet.",
    dateVerb: "Submitted", showScore: false, hrefSuffix: "",
  },
  graded: {
    title: "Results & Feedback", sub: "Only tests your teacher has already graded appear here.",
    searchId: "results-search", searchLabel: "Search results by test title",
    loading: "Loading your results…", emptyTitle: "No feedback yet",
    emptyBody: "Scores and feedback appear here after your teacher grades your work.",
    noMatchBody: "No graded work of this type yet.",
    dateVerb: "Graded", showScore: true, hrefSuffix: "?from=results",
  },
};

/** Student work lists over exam attempts: pending (submitted) or graded results with score/feedback. */
export function WorkHistory({ mode }: { mode: WorkHistoryMode }) {
  const copy = COPY[mode];
  const attempts = useFetch(() => apiGet<Page<ExamAttempt>>(`/api/v1/exam-attempts/me${qs({ limit: 50 })}`), []);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 100 })}`), []);
  const loading = attempts.loading || exams.loading;
  const error = attempts.error || exams.error;

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"" | "quiz" | "written" | "problem" | "project">("");
  // Filter only after the user pauses typing for 2s — not on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 2000);
  const typing = search !== debouncedSearch;

  const rows = useMemo<Row[]>(() => {
    const examById = new Map((exams.data?.items ?? []).map((e) => [String(e._id), e]));
    const wantState = mode === "pending" ? "submitted" : "graded";
    const list: Row[] = (attempts.data?.items ?? []).filter((a) => a.state === wantState).map((a) => {
      const e = examById.get(String(a.examId));
      return {
        id: String(a._id),
        date: a.submittedAt ?? a.createdAt,
        title: e?.title ?? "Test attempt",
        kind: KIND_LABEL[e?.kind ?? ""] ?? "Test",
        kindKey: e?.kind ?? "",
        state: a.state,
        score: a.score,
        feedback: a.feedback || "",
        href: `/student/my-exams/${a._id}${copy.hrefSuffix}`,
      };
    });
    return list.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [attempts.data, exams.data, mode, copy.hrefSuffix]);

  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter(
      (r) => (kind ? r.kindKey === kind : true) && (!q || r.title.toLowerCase().includes(q)),
    );
  }, [rows, debouncedSearch, kind]);

  const retryAll = () => { attempts.retry(); exams.retry(); };

  return (
    <div>
      <PageHead title={copy.title} sub={copy.sub} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchField id={copy.searchId} label={copy.searchLabel} value={search} onChange={setSearch} placeholder="Search by test title…" />
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted">Sort by</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "" | "quiz" | "written" | "problem" | "project")}
            className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-semibold outline-none">
            <option value="">All</option>
            <option value="quiz">Quiz</option>
            <option value="written">Written</option>
            <option value="problem">Problem</option>
            <option value="project">Project</option>
          </select>
        </label>
      </div>
      {typing && <p className="mt-2 text-xs text-muted" role="status">Waiting for you to stop typing…</p>}
      <div className="mt-4">
        {loading ? <Loading label={copy.loading} /> : error ? <ErrorBox message={error} onRetry={retryAll} /> :
          !rows.length ? <Empty title={copy.emptyTitle} body={copy.emptyBody} /> :
          !visible.length ? <Empty title="No matches" body={debouncedSearch ? `Nothing matched “${debouncedSearch.trim()}”.` : copy.noMatchBody} /> : (
            <DataList>
              {visible.map((r) => {
                const icon = (
                  <RowIcon tone={KIND_BOX[r.kind] ?? KIND_BOX.Test}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg>
                  </RowIcon>
                );
                const chip = <RowChip tone={KIND_BADGE[r.kind] ?? KIND_BADGE.Test}>{r.kind}</RowChip>;
                const stateBadge = <Badge tone={statusTone(r.state)}>{r.state.replace(/_/g, " ")}</Badge>;
                return (
                  <li key={r.id} className="p-4">
                    {/* Small screens: stacked card */}
                    <div className="flex flex-col gap-3 sm:hidden">
                      <div className="flex items-center gap-3">
                        {icon}
                        <span className="min-w-0 flex-1 truncate font-bold">{r.title}</span>
                        <span className="shrink-0">{chip}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-[13px] text-muted">
                        <span className="whitespace-nowrap">{copy.dateVerb} {fmtDate(r.date)}</span>
                        {stateBadge}
                        {copy.showScore && <span className="whitespace-nowrap font-bold text-ink">Score: {r.score ?? "—"}</span>}
                      </div>
                      {copy.showScore && (
                        <p className="line-clamp-2 pl-[52px] text-[13px] text-muted">
                          {r.feedback ? `“${r.feedback}”` : "No written feedback."}
                        </p>
                      )}
                      <div className="pl-[52px]">
                        <Link href={r.href} className="block rounded-lg bg-[#16a34a] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#15803d]">Open</Link>
                      </div>
                    </div>
                    {/* Large screens: original row, unchanged */}
                    <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:gap-5">
                      <div className="flex min-w-[200px] flex-1 items-start gap-3">
                        {icon}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{r.title}</span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {copy.dateVerb} {fmtDate(r.date)} · {stateBadge}
                            {copy.showScore && <> · <span className="font-bold text-ink">Score: {r.score ?? "—"}</span></>}
                          </span>
                          {copy.showScore && (r.feedback ? (
                            <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">“{r.feedback}”</span>
                          ) : (
                            <span className="mt-0.5 block text-[13px] text-muted">No written feedback.</span>
                          ))}
                        </span>
                        <span className="shrink-0 self-center">{chip}</span>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-4">
                        <Link href={r.href} className="rounded-lg bg-[#16a34a] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#15803d]">Open</Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </DataList>
          )}
      </div>
    </div>
  );
}
