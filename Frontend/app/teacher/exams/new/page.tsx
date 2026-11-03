"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHead } from "@/components/ui";

type TestType = "quiz" | "project" | "written" | "problem";

const CARDS: {
  key: TestType;
  icon: React.ReactNode;
  iconCls: string;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    key: "quiz",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m9 12 2 2 4-4" />
        <path d="M9 7h6M9 17h4" />
      </svg>
    ),
    iconCls: "bg-[#e6f9ec] text-[#16a34a]",
    title: "Quiz",
    body: "Multiple-choice questions with automatic grading.",
    points: [
      "MCQ and multiple correct options",
      "Add explanation for each question",
      "Instant result and auto grading",
      "Great for quick assessments",
    ],
  },
  {
    key: "project",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    ),
    iconCls: "bg-[#f1eafe] text-[#7c3aed]",
    title: "Project",
    body: "Students complete and submit a project.",
    points: [
      "Project based assignments",
      "File submission (PDF, ZIP, etc.)",
      "Custom instructions and requirements",
      "Manual grading by teacher",
    ],
  },
  {
    key: "written",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </svg>
    ),
    iconCls: "bg-[#e8f1fe] text-[#1d6ce0]",
    title: "Written Question",
    body: "Open-ended questions reviewed by the teacher.",
    points: [
      "Essay type questions",
      "Students write detailed answers",
      "Manual grading and feedback",
      "Suitable for descriptive assessments",
    ],
  },
  {
    key: "problem",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" />
      </svg>
    ),
    iconCls: "bg-[#feecdc] text-[#ea580c]",
    title: "Problem Solving",
    body: "Programming and logic problems evaluated against requirements.",
    points: [
      "Problems will be related to learning",
      "Problems link will be given",
      "Student will attempt and judge themselves",
      "Teacher no need to give feedback",
    ],
  },
];

export default function CreateTestPickerPage() {
  const router = useRouter();
  const [picked, setPicked] = useState<TestType>("quiz");

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <PageHead
        title="Create Test"
        sub="Choose the type of test you want to create."
      />
      <div
        className="grid gap-5 lg:grid-cols-2"
        role="radiogroup"
        aria-label="Test type"
      >
        {CARDS.map((c) => {
          const active = picked === c.key;
          return (
            <button
              key={c.key}
              role="radio"
              aria-checked={active}
              onClick={() => setPicked(c.key)}
              className={`rounded-2xl border bg-card p-6 text-left sm:p-7 ${active ? "border-[#16a34a] shadow-[0_0_0_1px_#16a34a]" : "border-line hover:border-muted card-hover"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl ${c.iconCls}`}
                >
                  {c.icon}
                </span>
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${active ? "border-[#16a34a]" : "border-line"}`}
                >
                  {active && (
                    <span className="h-3 w-3 rounded-full bg-[#16a34a]" />
                  )}
                </span>
              </div>
              <p className="mt-4 text-xl font-bold">{c.title}</p>
              <p className="mt-1 text-[15px] text-muted">{c.body}</p>
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {c.points.map((pt) => (
                  <li
                    key={pt}
                    className="flex items-start gap-2.5 text-[15px] text-muted"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#16a34a]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                    {pt}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() =>
            router.push(
              picked === "quiz"
                ? "/teacher/exams/new/quiz"
                : picked === "project"
                  ? "/teacher/exams/new/project"
                  : picked === "written"
                    ? "/teacher/exams/new/written"
                    : picked === "problem"
                      ? "/teacher/exams/new/problem"
                      : "/teacher/exams/new/advanced",
            )
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-10 py-3.5 text-[16px] font-semibold text-white hover:bg-[#15803d]"
        >
          Next
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
