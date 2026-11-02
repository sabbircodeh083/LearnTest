"use client";
import { use } from "react";
import Link from "next/link";
import { Badge, Btn, ErrorBox, Loading, PageHead } from "@/components/ui";
import { questionBadge } from "@/components/cards";
import { BuyPanel, Engagement } from "@/components/purchase";
import { apiGet } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Question } from "@/lib/types";

export default function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: q, error, loading, retry } = useFetch(() => apiGet<Question>(`/api/v1/questions/${id}`), [id]);

  if (loading) return <Loading label="Loading question…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!q) return <ErrorBox message="Question not found." onRetry={retry} />;

  return (
    <div>
      <Link href="/student/questions" className="text-sm font-semibold text-brandstrong">← All questions</Link>
      <div className="mt-3"><PageHead title={q.title} sub={`Published ${fmtDate(q.createdAt)}`} /></div>
      <article className="rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone={questionBadge(q).tone}>{questionBadge(q).label}</Badge>
          {q.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
        </div>
        <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">Prompt</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.prompt}</p>
        {q.description && (<><h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">About</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{q.description}</p></>)}
        <div className="mt-6 border-t border-line pt-5">
          <BuyPanel contentType="question" contentId={q._id} price={q.price} currency={q.currency} />
        </div>
        <p className="mt-4 text-xs text-muted">Answers and rubrics stay hidden until you own access through an exam or grading, exactly as the server returns them.</p>
      </article>
      <Engagement targetType="question" targetId={q._id} />
      <div className="mt-6"><Btn href="/student/my-exams" variant="ghost">Find an exam to attempt</Btn></div>
    </div>
  );
}
