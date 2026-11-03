import { redirect } from "next/navigation";

/** Legacy route: assignments were unified into project tests. */
export default async function TeacherAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/teacher/exams/${id}`);
}
