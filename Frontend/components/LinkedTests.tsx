"use client";
import Link from "next/link";
import { Badge, statusTone } from "./ui";
import { DataList, DataRow, RowChip, RowIcon } from "./DataList";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { SaveButton } from "@/lib/saved";
import type { Exam } from "@/lib/types";
import { priceLabel } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  quiz: "Quiz",
  written: "Written Exam",
  problem: "Problem Solving",
  project: "Project",
};
const KIND_BADGE: Record<string, string> = {
  quiz: "bg-[#e6f9ec] text-[#16a34a]",
  written: "bg-[#e8f1fe] text-[#1d6ce0]",
  problem: "bg-[#ede9fe] text-[#7c3aed]",
  project: "bg-[#ffedd5] text-[#c2410c]",
};

/** Tests & Exams table for the bottom of video and playlist pages. */
export function TestsExamsTable({ tests, title = "Tests & Exams", testHref }: { tests: Exam[]; title?: string; testHref?: (t: Exam) => string }) {
  const hrefOf = testHref ?? ((t) => `/student/tests/${t._id}?source=exam`);
  const key = tests.map((t) => String(t._id)).join(",");
  const counts = useFetch(async () => {
    const out: Record<string, number> = {};
    await Promise.all(
      tests.map(async (t) => {
        try {
          const p = await apiGet<{ questionCount: number }>(`/api/v1/exams/${t._id}/preview`);
          out[String(t._id)] = p.questionCount;
        } catch {
          /* paid/locked — count stays unknown */
        }
      }),
    );
    return out;
  }, [key]);

  if (!tests.length) return null;

  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
      <div className="mt-3">
        <DataList label={title}>
          {tests.map((t) => (
            <DataRow
              key={String(t._id)}
              icon={
                <RowIcon tone={KIND_BADGE[t.kind ?? "quiz"] ?? KIND_BADGE.quiz!}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0" /><path d="M9 11h6M9 15h4" /></svg>
                </RowIcon>
              }
              title={t.title}
              meta={
                <>
                  {counts.data?.[String(t._id)] ?? "—"} questions · {t.durationMinutes} min · {priceLabel(t.price, t.currency)}
                  {" · "}<Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </>
              }
              chip={<RowChip tone={KIND_BADGE[t.kind ?? "quiz"] ?? KIND_BADGE.quiz!}>{KIND_LABEL[t.kind ?? "quiz"] ?? "Quiz"}</RowChip>}
              actions={
                <>
                  <Link
                    href={hrefOf(t)}
                    className="rounded-lg bg-[#16a34a] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#15803d]"
                  >
                    Start
                  </Link>
                  <SaveButton targetType="exam" targetId={String(t._id)} />
                </>
              }
            />
          ))}
        </DataList>
      </div>
    </section>
  );
}
