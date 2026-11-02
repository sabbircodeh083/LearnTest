"use client";
import { AssignmentCard } from "@/components/cards";
import { Empty, ErrorBox, Loading, PageHead } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Assignment, Page } from "@/lib/types";

export default function StudentAssignmentsPage() {
  const { data, error, loading, retry } = useFetch(() => apiGet<Page<Assignment>>(`/api/v1/assignments${qs({ limit: 20 })}`), []);
  return (
    <div>
      <PageHead title="Assignments" sub="Open an assignment to read its instructions, upload your file (PDF or ZIP), and submit. Uploading is not the same as acceptance — scan and grading states stay visible." />
      {loading ? <Loading label="Loading assignments…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No assignments yet" body="Published assignments will appear here." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((a) => <AssignmentCard key={a._id} assignment={a} href={`/student/assignments/${a._id}`} />)}
          </div>
        )}
    </div>
  );
}
