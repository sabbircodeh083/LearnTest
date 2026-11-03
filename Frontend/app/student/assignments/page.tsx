import { redirect } from "next/navigation";

/** Legacy route: assignments were unified into project tests. */
export default function StudentAssignmentsPage() {
  redirect("/student?tab=tests");
}
