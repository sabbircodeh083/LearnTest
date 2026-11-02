"use client";
import SubmissionQueue from "../_components/SubmissionQueue";

export default function TeacherSubmissionsPage() {
  return (
    <SubmissionQueue
      state="pending"
      title="Submissions & Feedback"
      sub="Each student's current submission, awaiting your review and feedback."
      emptyTitle="No submissions awaiting review"
      emptyBody="A student's current submission appears here once they submit it. Graded work moves to the Archive."
    />
  );
}
