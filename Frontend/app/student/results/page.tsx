import { redirect } from "next/navigation";

/** Legacy route: Results & Feedback now lives at /student/graded-submissions. */
export default function ResultsPage() {
  redirect("/student/graded-submissions");
}
