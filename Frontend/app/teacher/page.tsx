"use client";
import Link from "next/link";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { idOf, type Exam, type MyTestPage, type Page, type Video } from "@/lib/types";

function StatIcon({ tone }: { tone: "green" | "blue" | "purple" | "orange" }) {
  const box: Record<string, string> = {
    green: "bg-[#e6f9ec] text-[#16a34a] dark:bg-brandsoft dark:text-brandstrong",
    blue: "bg-[#e8f1fe] text-[#2f80ed] dark:bg-infosoft dark:text-ink",
    purple: "bg-[#f1eafe] text-[#7c3aed] dark:bg-brandsoft dark:text-brandstrong",
    orange: "bg-[#feecdc] text-[#ea580c] dark:bg-warnsoft dark:text-warn",
  };
  const paths: Record<string, React.ReactNode> = {
    green: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></>),
    blue: (<><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5l5-2.8v8.6l-5-2.8" /><circle cx="8.5" cy="12" r="1.6" /><path d="M8.5 10.8v2.4l2-1.2z" /></>),
    purple: (<><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></>),
    orange: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 7.5v9M14.2 9.3c-.5-.8-1.3-1.1-2.2-1.1-1.2 0-2.2.7-2.2 1.8 0 2.4 4.8 1.1 4.8 3.5 0 1-1 1.7-2.2 1.7-.9 0-1.7-.3-2.2-1.1" /></>),
  };
  return (
    <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${box[tone]}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{paths[tone]}</svg>
    </span>
  );
}

function StatCard({ icon, label, value, href }: { icon: "green" | "blue" | "purple" | "orange"; label: string; value: string; href: string }) {
  return (
    <Link href={href} aria-label={`${label}: ${value}`}
      className="flex items-start gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:shadow-[0_8px_24px_rgba(16,24,40,0.14)] dark:hover:shadow-[0_8px_24px_rgba(255,255,255,0.16)]">
      <StatIcon tone={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="mt-1 block text-[28px] font-bold leading-none tracking-tight">{value}</span>
      </span>
    </Link>
  );
}

const KIND_META: Record<string, { label: string; box: string; icon: React.ReactNode }> = {
  quiz: {
    label: "Quiz", box: "bg-[#fce7f3] text-[#db2777]",
    icon: (<><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>),
  },
  written: {
    label: "Written", box: "bg-[#dbeafe] text-[#2563eb]",
    icon: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></>),
  },
  problem: {
    label: "Problem Solving", box: "bg-[#ede9fe] text-[#7c3aed]",
    icon: (<><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" /></>),
  },
  project: {
    label: "Project", box: "bg-[#ffedd5] text-[#ea580c]",
    icon: (<><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  },
};

function TypeBadge({ testKind }: { testKind?: string }) {
  const meta = KIND_META[testKind ?? "quiz"] ?? KIND_META.quiz!;
  return <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold ${meta.box}`}>{meta.label}</span>;
}

function TypeIcon({ testKind }: { testKind?: string }) {
  const meta = KIND_META[testKind ?? "quiz"] ?? KIND_META.quiz!;
  return (
    <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.box}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {meta.icon}
      </svg>
    </span>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, limit: 1 })}`), []);
  // All tests (exams of every kind), newest first.
  const tests = useFetch(() => apiGet<MyTestPage>(`/api/v1/my-tests${qs({ limit: 1 })}`), []);
  const exams = useFetch(() => apiGet<Page<Exam>>(`/api/v1/exams${qs({ mine: 1, limit: 30 })}`), []);
  const followers = useFetch(() => apiGet<{ total: number }>(`/api/v1/follows/followers${qs({ limit: 1 })}`), []);
  // Collected revenue: sum of every PAID purchase of this teacher's content.
  const sales = useFetch(async () => {
    let page = 1;
    let amount = 0;
    let count = 0;
    for (;;) {
      const d = await apiGet<Page<{ amount: number }>>(`/api/v1/purchases/sales/me${qs({ status: "paid", page, limit: 100 })}`);
      for (const s of d.items ?? []) { amount += Number(s.amount) || 0; count++; }
      if ((d.items ?? []).length < 100 || count >= (d.total ?? 0)) break;
      if (++page > 50) break; // safety cap: 5,000 sales
    }
    return { amount, count };
  }, []);
  const loading = videos.loading || tests.loading || exams.loading || followers.loading || sales.loading;
  const error = videos.error || tests.error || exams.error || followers.error || sales.error;
  const firstName = user?.name?.split(" ")[0] || "Teacher";
  const examIds = (exams.data?.items ?? []).map((e) => String(e._id));
  const ratings = useFetch(
    () => examIds.length
      ? apiGet<{ items: { targetId: string; avg: number; count: number }[] }>(`/api/v1/ratings/summary${qs({ targetType: "exam", targetIds: examIds.join(",") })}`)
      : Promise.resolve({ items: [] as { targetId: string; avg: number; count: number }[] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examIds.join(",")],
  );
  const ratingById = new Map((ratings.data?.items ?? []).map((r) => [r.targetId, r]));
  const top = [...(exams.data?.items ?? [])]
    .sort((a, b) => (ratingById.get(String(b._id))?.avg ?? -1) - (ratingById.get(String(a._id))?.avg ?? -1))
    .slice(0, 3);

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">Dashboard</h1>
          <p className="mt-1 text-[17px] text-muted">Welcome back, <span className="font-bold text-ink">{user?.name || firstName}</span> <span aria-hidden>👋</span></p>
          <p className="mt-1 text-[15px] text-muted">Here&apos;s an overview of your content and engagement.</p>
        </div>
        <button className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm font-medium shadow-sm" aria-label="Date range (visual only)">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
          <span>Oct 1, 2024 - Oct 26, 2024</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      {loading ? <div className="mt-6"><Loading label="Loading your studio…" /></div>
        : error ? <div className="mt-6"><ErrorBox message={error} onRetry={() => { videos.retry(); tests.retry(); exams.retry(); followers.retry(); sales.retry(); }} /></div>
        : (
          <>
            {/* Stat cards */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon="green" label="Total Followers" value={(followers.data?.total ?? 0).toLocaleString()} href="/teacher/students" />
              <StatCard icon="blue" label="Total Videos" value={(videos.data?.total ?? 0).toLocaleString()} href="/teacher/videos" />
              <StatCard icon="purple" label="Total Tests" value={(tests.data?.total ?? 0).toLocaleString()} href="/teacher/exams" />
              <StatCard icon="orange" label="Total Earnings" value={`$ ${(sales.data?.amount ?? 0).toLocaleString()}`} href="/teacher/earnings" />
            </div>

            {/* Highest-Rated Tests */}
            <section className="mt-5 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Highest-Rated Tests">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Highest-Rated Tests</h2>
              <p className="mt-1 text-[15px] text-muted">Your best performing tests based on student ratings.</p>

              {!top.length ? (
                <div className="mt-5"><Empty title="No tests yet" body="Create your first test and it will appear here with its real question count." action={<Link href="/teacher/exams/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Create Test</Link>} /></div>
              ) : (
                <ol className="mt-2 divide-y divide-line">
                  {top.map((exam, i) => {
                    const qCount = exam.questionCount ?? exam.questionIds?.length ?? 0;
                    const r = ratingById.get(idOf(exam));
                    return (
                      <li key={idOf(exam)} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <span className="w-4 shrink-0 text-[15px] text-muted">{i + 1}</span>
                          <TypeIcon testKind={exam.kind} />
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                              <span className="truncate">{exam.title}</span>
                              <TypeBadge testKind={exam.kind} />
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{exam.description || "No description yet."}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-6 pl-8 lg:pl-0">
                          <div className="space-y-1.5 text-sm text-muted">
                            <p className="flex items-center gap-2">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.3a2.5 2.5 0 1 1 3.4 2.4c-.8.3-.9 1-.9 1.6" /><circle cx="12" cy="16.5" r="0.5" fill="currentColor" /></svg>
                              {qCount} questions
                            </p>
                            <p className="flex items-center gap-2">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="16.5" cy="9" r="2.4" /><path d="M15.5 13.8c2.7.4 4.7 2.5 4.7 5.2" /></svg>
                              max {exam.maxAttempts == null ? "No bound" : `${exam.maxAttempts} attempt${exam.maxAttempts === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <div className="min-w-[110px]">
                            {r ? (
                              <>
                                <p className="flex items-center gap-1.5 text-[17px] font-bold"><span aria-hidden className="text-[#f5a623]">★</span> {r.avg.toFixed(1)}</p>
                                <p className="mt-0.5 text-sm text-muted">({r.count} rating{r.count === 1 ? "" : "s"})</p>
                              </>
                            ) : (
                              <>
                                <p className="flex items-center gap-1.5 text-[17px] font-bold"><span aria-hidden className="text-[#f5a623]">★</span> —</p>
                                <p className="mt-0.5 text-sm text-muted">No ratings yet</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 pl-8 lg:pl-0">
                          <Link href={`/teacher/exams/${idOf(exam)}`} className="inline-flex items-center justify-center rounded-lg bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]">
                            View Details
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
    </div>
  );
}
