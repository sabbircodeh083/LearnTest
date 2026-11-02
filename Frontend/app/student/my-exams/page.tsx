"use client";
import { PracticeTests, useTeacherProfiles } from "@/components/discover";

export default function StudentTestsPage() {
  const { nameOf, avatarOf } = useTeacherProfiles();

  return (
    <div>
      <div className="pb-10">
        <PracticeTests
          testHref={(t) => `/student/tests/${t.id}?source=${t.source}`}
          nameOf={nameOf}
          avatarOf={avatarOf}
          actionLabel="Attempt Test"
          from="tests"
          title="All Tests"
          sub="Find and attempt quizzes, written exams, and projects from your favorite teachers."
          showSave
        />
      </div>
    </div>
  );
}
