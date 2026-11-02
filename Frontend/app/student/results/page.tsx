"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, PageHead, statusTone } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch, useDebouncedValue } from "@/lib/hooks";
import { fmtDate, type Assignment, type Exam, type ExamAttempt, type Page, type Submission } from "@/lib/types";

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

export default function ResultsPage() {
  const subs = useFetch(() => apiGet<Page<Submission>>(`/api/v1/submissions/me${qs({ limit: 50 })}`), []);
  const attempts = useFetch(() => apiGet<Page<ExamAttempt>>(`/api/v1/exam-attempts/me${qs({ limit: 50 })}`), []);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ limit: 100 })}`), []);
  const assignments = useFetch(() => apiGet<Page<Assignment>>(`/api/v1/assignments${qs({ limit: 100 })}`), []);
  const loading = subs.loading || attempts.loading || exams.loading || assignments.loading;
  const error = subs.error || attempts.error || exams.error || assignments.error;

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"" | "quiz" | "written" | "problem" | "project">("");
  // Filter only after the user pauses typing for 2s — not on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 2000);
  const typing = search !== debouncedSearch;

  // Only work the teacher has already graded — pending/in-progress items never appear here.
  const rows = useMemo<Row[]>(() => {
    const examById = new Map((exams.data?.items ?? []).map((e) => [String(e._id), e]));
    const assignmentById = new Map((assignments.data?.items ?? []).map((a) => [String(a._id), a]));
    const list: Row[] = [
      ...((subs.data?.items ?? []).filter((s) => s.state === "graded")).map((s) => ({
        id: String(s._id),
        date: s.createdAt,
        title: assignmentById.get(String(s.assignmentId))?.title ?? "Project submission",
        kind: "Project",
        kindKey: "project",
        state: s.state,
        score: s.grade,
        feedback: s.feedback || "",
        href: `/student/assignments/${s.assignmentId}?from=results`,
      })),
      ...((attempts.data?.items ?? []).filter((a) => a.state === "graded")).map((a) => {
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
          href: `/student/my-exams/${a._id}?from=results`,
        };
      }),
    ];
    return list.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [subs.data, attempts.data, exams.data, assignments.data]);

  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter(
      (r) => (kind ? r.kindKey === kind : true) && (!q || r.title.toLowerCase().includes(q)),
    );
  }, [rows, debouncedSearch, kind]);

  const retryAll = () => { subs.retry(); attempts.retry(); exams.retry(); assignments.retry(); };

  return (
    <div>
      <PageHead title="Results & Feedback" sub="Only tests your teacher has already graded appear here." />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr-only" htmlFor="results-search">Search results by test title</label>
          <input id="results-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by test title…" className="w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70" />
        </div>
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
        {loading ? <Loading label="Loading your results…" /> : error ? <ErrorBox message={error} onRetry={retryAll} /> :
          !rows.length ? <Empty title="No feedback yet" body="Scores and feedback appear here after your teacher grades your work." /> :
          !visible.length ? <Empty title="No matches" body={debouncedSearch ? `Nothing matched “${debouncedSearch.trim()}”.` : "No graded work of this type yet."} /> : (
            <ol className="divide-y divide-line rounded-xl border border-line bg-card">
              {visible.map((r) => (
                <li key={r.id} className="flex flex-row flex-wrap items-center gap-3 p-4 lg:gap-5">
                  <div className="flex min-w-[200px] flex-1 items-start gap-3">
                    <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${KIND_BOX[r.kind] ?? KIND_BOX.Test}`}>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{r.title}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        Graded {fmtDate(r.date)} · <Badge tone={statusTone(r.state)}>{r.state.replace(/_/g, " ")}</Badge> · <span className="font-bold text-ink">Score: {r.score ?? "—"}</span>
                      </span>
                      {r.feedback ? (
                        <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">“{r.feedback}”</span>
                      ) : (
                        <span className="mt-0.5 block text-[13px] text-muted">No written feedback.</span>
                      )}
                    </span>
                    <span className="shrink-0 self-center"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${KIND_BADGE[r.kind] ?? KIND_BADGE.Test}`}>{r.kind}</span></span>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-4">
                    <Link href={r.href} className="rounded-lg bg-[#16a34a] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#15803d]">Open</Link>
                  </div>
                </li>
              ))}
            </ol>
          )}
      </div>
    </div>
  );
}
