import { ContentForm } from "@/components/ContentForm";
import { PageHead } from "@/components/ui";
export default function Page() {
  return <div><PageHead title="New question" sub="The answer and rubric stay server-side hidden from students in lists and exam attempts." /><ContentForm kind="question" endpoint="/api/v1/questions" backHref="/teacher/questions" /></div>;
}
