"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Empty, ErrorBox, Loading, useToast } from "@/components/ui";
import { startCheckout } from "@/components/purchase";
import { SaveButton } from "@/lib/saved";
import { AvatarImg } from "@/components/profile";
import { apiGet, apiPost, ApiError, qs } from "@/lib/api";
import { safeExternalUrl } from "@/lib/url";
import { ModalShell } from "@/components/AlertDialog";
import { useFetch } from "@/lib/hooks";
import {
  currencySymbol,
  fmtDate,
  type ExamAttempt,
  type Page,
} from "@/lib/types";

const cardCls =
  "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6 card-hover";

interface ExamPreview {
  _id: string;
  ownerId: string;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  status: string;
  price: number;
  currency: string;
  kind: "quiz" | "written" | "problem" | "project";
  durationMinutes: number;
  maxAttempts: number | null;
  accessPolicy: string;
  passingMarks: number;
  startsAt: string | null;
  endsAt: string | null;
  playlistId: string | null;
  videoId: string;
  questionCount: number;
  totalMarks: number;
  entitled: boolean;
  details:
    | null
    | { problems: { title: string; url: string }[] }
    | {
        criteria: { label: string; marks: number }[];
        slots: { title: string; type: string }[];
        submissionTypes: string[];
        maxFileSize: string;
        maxFiles: number;
      };
  createdAt: string;
}

const KIND_META: Record<
  string,
  { label: string; box: string; icon: React.ReactNode }
> = {
  quiz: {
    label: "Quiz",
    box: "bg-[#fce7f3] text-[#db2777]",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  written: {
    label: "Written",
    box: "bg-[#dbeafe] text-[#2563eb]",
    icon: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
  },
  problem: {
    label: "Problem Solving",
    box: "bg-[#ede9fe] text-[#7c3aed]",
    icon: (
      <>
        <path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" />
      </>
    ),
  },
  project: {
    label: "Project",
    box: "bg-[#ffedd5] text-[#ea580c]",
    icon: (
      <>
        <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </>
    ),
  },
};

function ExamPreviewView({
  preview,
  teacher,
  returnTo,
}: {
  preview: ExamPreview;
  teacher: { name: string; avatarUploadId: string | null };
  returnTo: string;
}) {
  const toast = useToast();
  const [payAlert, setPayAlert] = useState(false);
  const [busy, setBusy] = useState<"attempt" | "pay" | null>(null);
  const [note, setNote] = useState("");
  const meta = KIND_META[preview.kind] ?? KIND_META.quiz!;
  const paid = preview.price > 0;
  const locked = paid && !preview.entitled;

  const mine = useFetch(
    () =>
      apiGet<Page<ExamAttempt>>(
        `/api/v1/exam-attempts/me${qs({ limit: 100 })}`,
      ),
    [],
  );
  const myAttempts = useMemo(
    () =>
      (mine.data?.items ?? []).filter(
        (a) => String(a.examId) === String(preview._id),
      ),
    [mine.data, preview._id],
  );
  const active = myAttempts.find((a) => a.state === "in_progress") ?? null;
  const used = myAttempts.length;
  const exhausted = preview.maxAttempts != null && used >= preview.maxAttempts && !active;
  const attemptsLoading = mine.loading;

  const startAttempt = async () => {
    if (locked) {
      setPayAlert(true);
      return;
    }
    setBusy("attempt");
    try {
      const attempt = await apiPost<ExamAttempt>(
        `/api/v1/exams/${preview._id}/attempts`,
      );
      toast("Attempt started. Good luck!");
      window.location.href = `/student/my-exams/${attempt._id}`;
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "Could not start this test.",
        "err",
      );
    } finally {
      setBusy(null);
    }
  };

  const payFirst = async () => {
    setBusy("pay");
    setNote("");
    try {
      const gatewayUrl = await startCheckout("exam", preview._id, returnTo);
      if (gatewayUrl) {
        toast("Taking you to SSLCOMMERZ to complete payment…");
        window.location.href = gatewayUrl;
      } else {
        setNote(
          "A pending order was created. Payment gateway credentials are not configured yet, so checkout cannot continue.",
        );
      }
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "Could not start payment.",
        "err",
      );
    } finally {
      setBusy(null);
    }
  };

  const details = preview.details as ExamPreview["details"];

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${meta.box}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {meta.icon}
          </svg>
        </span>
        <div>
          <p>
            <span
              className={`inline-flex rounded-md px-2.5 py-0.5 text-[13px] font-semibold ${meta.box}`}
            >
              {meta.label}
            </span>
          </p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight">
            {preview.title}
          </h1>
          <p className="text-sm text-muted">by <Link href={`/student/teachers/${preview.ownerId}`} className="inline-flex items-center gap-1.5 font-semibold text-brandstrong hover:underline">
            <AvatarImg uploadId={teacher.avatarUploadId} name={teacher.name} className="h-5 w-5 rounded-full text-[10px]" />
            {teacher.name}
          </Link></p>
        </div>
        <span className="ml-auto shrink-0"><SaveButton targetType="exam" targetId={String(preview._id)} /></span>
      </div>

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className={cardCls} aria-label="About this test">
            <h2 className="text-[17px] font-bold">About this test</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted">
              {preview.description || "No description."}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <div>
                📝 {preview.questionCount} question
                {preview.questionCount === 1 ? "" : "s"} · {preview.totalMarks}{" "}
                marks
              </div>
              {preview.kind !== "project" ? (
                <div>⏱ {preview.durationMinutes} minutes</div>
              ) : (
                <div>
                  📅{" "}
                  {preview.endsAt
                    ? `Due ${fmtDate(preview.endsAt)}`
                    : "No deadline"}
                </div>
              )}
              {preview.kind === "problem" ? (
                <div>💪 Practice only — no submission needed</div>
              ) : (
                <div>
                  {preview.maxAttempts == null ? (
                    <>🔁 {used} attempt{used === 1 ? "" : "s"} used · No bound</>
                  ) : (
                    <>🔁 {used} of {preview.maxAttempts} attempt{preview.maxAttempts === 1 ? "" : "s"} used</>
                  )}
                </div>
              )}
              {preview.passingMarks > 0 && (
                <div>🎯 Pass at {preview.passingMarks}</div>
              )}
            </dl>
          </section>

          {preview.kind === "quiz" && (
            <section className={cardCls} aria-label="How it works">
              <h2 className="text-[17px] font-bold">How it works</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>
                  Answer {preview.questionCount} multiple-choice question
                  {preview.questionCount === 1 ? "" : "s"} within{" "}
                  {preview.durationMinutes} minutes.
                </li>
                <li>MCQ answers grade instantly on submit.</li>
                <li>
                  {preview.maxAttempts == null ? (
                    <>You have unlimited attempts (No bound).</>
                  ) : (
                    <>You have {preview.maxAttempts} attempt{preview.maxAttempts === 1 ? "" : "s"}.</>
                  )}
                </li>
              </ul>
            </section>
          )}

          {preview.kind === "written" && (
            <section className={cardCls} aria-label="Instructions">
              <h2 className="text-[17px] font-bold">Instructions for you</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Answer all questions in your own words.</li>
                <li>You may attach your answers as a single PDF file.</li>
                <li>A teacher grades each answer with marks and comments.</li>
              </ul>
            </section>
          )}

          {preview.kind === "problem" && (
            <section className={cardCls} aria-label="Problem list">
              <h2 className="text-[17px] font-bold">
                Problems (
                {details && "problems" in details
                  ? details.problems.length
                  : preview.questionCount}
                )
              </h2>
              {details && "problems" in details ? (
                <div className="mt-3 space-y-2">
                  {details.problems.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg border border-line p-3"
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold"
                      >
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-bold">
                        {p.title}
                      </p>
                      {safeExternalUrl(p.url) && (
                        <a
                          href={safeExternalUrl(p.url) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1d6ce0] px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                        >
                          Solve
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  This is a paid test — unlock it to see the problem list.
                </p>
              )}
            </section>
          )}

          {preview.kind === "project" && (
            <section className={cardCls} aria-label="Project requirements">
              <h2 className="text-[17px] font-bold">Project requirements</h2>
              {details && "criteria" in details ? (
                <>
                  {!!details.criteria.length && (
                    <ul className="mt-3 space-y-2">
                      {details.criteria.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-sm"
                        >
                          <span className="font-semibold">{c.label}</span>
                          <span className="text-muted">{c.marks} marks</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!details.slots.length && (
                    <>
                      <h3 className="mt-4 text-[15px] font-bold">
                        What to submit
                      </h3>
                      <ul className="mt-2 space-y-2">
                        {details.slots.map((s, i) => (
                          <li
                            key={i}
                            className="rounded-lg bg-soft px-3.5 py-2.5 text-sm"
                          >
                            <span className="font-semibold">
                              {i + 1}. {s.title}
                            </span>
                            <span className="ml-2 text-muted">
                              ({s.type === "short" ? "link" : "file / text"})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  This is a paid test — unlock it to see the requirements and
                  marking criteria.
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20">
          {preview.kind === "problem" ? (
            <section className={cardCls} aria-label="Take this test">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{preview.title}</p>
                {paid && (
                  <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">
                    {currencySymbol(preview.currency)} {preview.price}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                🏆 {preview.totalMarks} Marks · 📅{" "}
                {preview.endsAt ? fmtDate(preview.endsAt) : "No deadline"}
              </p>
              {paid && !preview.entitled ? (
                <div className="mt-3 rounded-lg border border-[#f5c518] bg-[#fffaeb] p-3 text-[13px] dark:bg-soft">
                  <p className="font-bold">Paid test — unlock to practice.</p>
                  <p className="mt-0.5 text-muted">
                    Pay once to unlock all problems in this set.
                  </p>
                </div>
              ) : paid ? (
                <p className="mt-3 inline-flex rounded-md bg-[#dcfce7] px-2.5 py-1 text-[13px] font-bold text-[#16a34a]">
                  Purchased — you have access
                </p>
              ) : null}
              {note && (
                <p
                  role="note"
                  className="mt-2 rounded-lg bg-warnsoft px-3 py-2 text-[13px] text-warn"
                >
                  {note}
                </p>
              )}
              {paid && !preview.entitled && (
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void payFirst()}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1d6ce0] px-4 py-3 text-sm font-semibold text-[#1d6ce0] hover:bg-[#eff6ff] disabled:opacity-50"
                  >
                    {busy === "pay"
                      ? "Starting checkout…"
                      : `Pay ${currencySymbol(preview.currency)} ${preview.price}`}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className={cardCls} aria-label="Take this test">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{preview.title}</p>
                {paid && (
                  <span className="shrink-0 rounded-md bg-[#dcfce7] px-2 py-0.5 text-sm font-bold text-[#16a34a]">
                    {currencySymbol(preview.currency)} {preview.price}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                🏆 {preview.totalMarks} Marks · 📅{" "}
                {preview.endsAt ? fmtDate(preview.endsAt) : "No deadline"} · 📄{" "}
                {preview.maxAttempts == null ? `${used} attempts used · No bound` : `${used}/${preview.maxAttempts} attempts used`}
              </p>
              {paid && !preview.entitled ? (
                <div className="mt-3 rounded-lg border border-[#f5c518] bg-[#fffaeb] p-3 text-[13px] dark:bg-soft">
                  <p className="font-bold">Paid test — unlock to attempt.</p>
                  <p className="mt-0.5 text-muted">
                    {preview.maxAttempts == null ? (
                      <>Pay once, then attempt as many times as you want (No bound).</>
                    ) : (
                      <>Pay once, then attempt up to {preview.maxAttempts} time{preview.maxAttempts === 1 ? "" : "s"}.</>
                    )}
                  </p>
                </div>
              ) : paid ? (
                <p className="mt-3 inline-flex rounded-md bg-[#dcfce7] px-2.5 py-1 text-[13px] font-bold text-[#16a34a]">
                  Purchased — you have access
                </p>
              ) : null}
              {note && (
                <p
                  role="note"
                  className="mt-2 rounded-lg bg-warnsoft px-3 py-2 text-[13px] text-warn"
                >
                  {note}
                </p>
              )}
              <div className="mt-3 grid gap-2">
                {active ? (
                  <Link
                    href={`/student/my-exams/${active._id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803d]"
                  >
                    Continue Attempt #{active.attemptNumber}
                  </Link>
                ) : exhausted ? (
                  <p
                    role="note"
                    className="rounded-xl border border-line bg-soft px-4 py-3 text-center text-sm font-semibold text-muted"
                  >
                    You have used all {preview.maxAttempts} attempt
                    {preview.maxAttempts === 1 ? "" : "s"}. Check Results & Feedback
                    for your result.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startAttempt()}
                    disabled={busy !== null || attemptsLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                  >
                    {busy === "attempt"
                      ? "Starting…"
                      : attemptsLoading
                        ? "Loading…"
                        : "➤ Attempt Test"}
                  </button>
                )}
                {paid && !preview.entitled && (
                  <button
                    type="button"
                    onClick={() => void payFirst()}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1d6ce0] px-4 py-3 text-sm font-semibold text-[#1d6ce0] hover:bg-[#eff6ff] disabled:opacity-50"
                  >
                    {busy === "pay"
                      ? "Starting checkout…"
                      : `Pay ${currencySymbol(preview.currency)} ${preview.price}`}
                  </button>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* paid alert */}
      {payAlert && (
        <ModalShell label="Paid test" onClose={() => setPayAlert(false)}>
            <h2 className="text-lg font-bold">This is a paid test</h2>
            <p className="mt-1 text-sm text-muted">
              “{preview.title}” costs {currencySymbol(preview.currency)} {preview.price}. Pay first to unlock
              {preview.maxAttempts == null ? (
                <> unlimited attempts (No bound).</>
              ) : (
                <> your {preview.maxAttempts} attempt{preview.maxAttempts === 1 ? "" : "s"}.</>
              )}
            </p>
            {note && (
              <p
                role="note"
                className="mt-3 rounded-lg bg-warnsoft px-3 py-2 text-[13px] text-warn"
              >
                {note}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayAlert(false)}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void payFirst()}
                disabled={busy !== null}
                className="rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
              >
                {busy === "pay" ? "Starting checkout…" : "Pay First"}
              </button>
            </div>
        </ModalShell>
      )}
    </>
  );
}

function PreviewInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const fromParam = search.get("from");
  const playlistId = search.get("playlistId");
  const vParam = search.get("v");
  const playlistBack = playlistId ? `/student/playlists/${playlistId}${vParam ? `?v=${vParam}` : ""}` : "/student/my-exams";
  const backHref =
    fromParam === "playlist" ? playlistBack
    : fromParam === "saved" ? "/student/saved-content" : fromParam === "purchases" ? "/student/purchases" : fromParam === "home" ? "/student?tab=tests" : "/student/my-exams";
  const backLabel =
    fromParam === "playlist" ? "Playlist"
    : fromParam === "saved" ? "Saved Content" : fromParam === "purchases" ? "Purchased Content" : fromParam === "home" ? "Practice with Tests" : "Tests";
  const playlistSuffix = fromParam === "playlist" && playlistId ? `&from=playlist&playlistId=${encodeURIComponent(playlistId)}${vParam ? `&v=${encodeURIComponent(vParam)}` : ""}` : "";
  const returnTo = `/student/tests/${encodeURIComponent(id)}?${fromParam === "saved" ? "from=saved" : fromParam === "purchases" ? "from=purchases" : fromParam === "home" ? "from=home" : ""}${playlistSuffix || (fromParam !== "saved" && fromParam !== "purchases" && fromParam !== "home" && fromParam !== "playlist" ? "from=tests" : "")}`;

  const examPreview = useFetch(() => apiGet<ExamPreview>(`/api/v1/exams/${id}/preview`), [id]);
  const teachers = useFetch(
    () =>
      apiGet<Page<{ userId: string; name: string; avatarUploadId: string | null }>>(
        `/api/v1/teachers${qs({ limit: 100 })}`,
      ),
    [],
  );
  const teacherOf = (ownerId: string) => {
    const t = (teachers.data?.items ?? []).find((x) => String(x.userId) === String(ownerId));
    return { name: t?.name || "Teacher", avatarUploadId: t?.avatarUploadId ?? null };
  };

  const loading = examPreview.loading;
  const error = examPreview.error;
  const retry = () => examPreview.retry();

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href={backHref} className="text-[15px] text-muted hover:text-ink">
        ←&nbsp;&nbsp;{backLabel}
      </Link>
      <div className="mt-2">
        {loading ? (
          <Loading label="Loading test…" />
        ) : error ? (
          <ErrorBox message={error} onRetry={retry} />
        ) : examPreview.data ? (
          <ExamPreviewView
            preview={examPreview.data}
            teacher={teacherOf(examPreview.data.ownerId)}
            returnTo={returnTo}
          />
        ) : (
          <Empty
            title="Test not found"
            body="This test may have been removed."
          />
        )}
      </div>
    </div>
  );
}

export default function StudentTestPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
          <Loading label="Loading test…" />
        </div>
      }
    >
      <PreviewInner />
    </Suspense>
  );
}
