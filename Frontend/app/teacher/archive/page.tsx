"use client";
import SubmissionQueue from "../_components/SubmissionQueue";

export default function TeacherArchivePage() {
  return (
    <SubmissionQueue
      state="graded"
      title="Archive"
      sub="Submissions you have already graded, newest first."
      emptyTitle="Nothing archived yet"
      emptyBody="Graded submissions move here automatically once you save a grade."
    />
  );
}
