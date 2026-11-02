import { ContentForm } from "@/components/ContentForm";
import { Notice, PageHead } from "@/components/ui";
export default function Page() {
  return (
    <div>
      <PageHead title="Create test (advanced)" sub="Build any test type from existing question IDs. For a guided MCQ quiz with instant auto-grading, use Create Quiz instead." />
      <div className="mb-5"><Notice tone="blue">Paste question IDs in order, set duration and attempt limits, then publish. Copy IDs from your Questions page.</Notice></div>
      <ContentForm kind="exam" endpoint="/api/v1/exams" backHref="/teacher/exams" />
    </div>
  );
}
