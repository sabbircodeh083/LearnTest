"use client";
import Link from "next/link";
import { Badge, statusTone } from "./ui";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { SaveButton } from "@/lib/saved";
import type { Exam } from "@/lib/types";

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
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="text-[13px] text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Questions</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tests.map((t, i) => (
              <tr key={String(t._id)}>
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="max-w-[220px] truncate px-4 py-3 font-semibold">{t.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${KIND_BADGE[t.kind ?? "quiz"] ?? KIND_BADGE.quiz}`}>
                    {KIND_LABEL[t.kind ?? "quiz"] ?? "Quiz"}
                  </span>
                </td>
                <td className="px-4 py-3">{counts.data?.[String(t._id)] ?? "—"}</td>
                <td className="px-4 py-3">{t.durationMinutes} min</td>
                <td className="px-4 py-3">{(t.price ?? 0) > 0 ? `৳ ${t.price}` : "Free"}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <Link
                      href={hrefOf(t)}
                      className="rounded-lg bg-[#16a34a] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#15803d]"
                    >
                      Start
                    </Link>
                    <SaveButton targetType="exam" targetId={String(t._id)} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
