import { redirect } from "next/navigation";

/** Legacy route: assignments were unified into project tests (All Tests). */
export default function TeacherAssignmentsPage() {
  redirect("/teacher/exams?type=project");
}
