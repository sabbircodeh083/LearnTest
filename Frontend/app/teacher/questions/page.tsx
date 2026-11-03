"use client";
import { useMemo, useState } from "react";
import { Badge, Btn, Empty, ErrorBox, Loading, PageHead, statusTone, useToast, inputCls } from "@/components/ui";
import { questionBadge } from "@/components/cards";
import { apiDelete, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Page, Question } from "@/lib/types";

export default function TeacherQuestionsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<Question>>(`/api/v1/questions${qs({ mine: 1, limit: 50 })}`), []);

  const matches = useMemo(() => {
    const items = data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    if (term.startsWith("#")) {
      const tag = term.slice(1);
      return items.filter((q) => q.tags.some((t) => t.toLowerCase().includes(tag)));
    }
    return items.filter((q) =>
      q.title.toLowerCase().includes(term) ||
      q.prompt.toLowerCase().includes(term) ||
      q.tags.some((t) => t.toLowerCase().includes(term.replace(/^#/, ""))));
  }, [data, search]);

  const highlighted = matches.find((q) => q._id === highlightId) ?? matches[0] ?? null;

  const act = async (q: Question, action: "publish" | "draft" | "hide") => {
    try {
      if (action === "hide") { await apiDelete(`/api/v1/questions/${q._id}`); toast("Question hidden."); }
      else { await apiPatch(`/api/v1/questions/${q._id}`, { status: action === "publish" ? "published" : "draft" }); toast("Saved."); }
      retry();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Action failed.", "err"); }
  };

  return (
    <div>
      <PageHead title="Questions" sub="Your question bank. Search by title, or type #tag to filter by hashtag. Select a result to highlight it."
        action={<Btn href="/teacher/questions/new">New question</Btn>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-4">
            <label className="sr-only" htmlFor="highlight-search">Search by title or #tag</label>
            <input id="highlight-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, or #algebra…" className={inputCls} />
            <p className="mt-1 text-xs text-muted">{matches.length} matching question{matches.length === 1 ? "" : "s"}{search ? ` for “${search}”` : ""}</p>
          </form>
          {loading ? <Loading label="Loading your questions…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
            !matches.length ? <Empty title="No matching questions" body="Try a different title keyword or #tag, or create a new question." action={<Btn href="/teacher/questions/new">New question</Btn>} /> : (
              <ul className="space-y-3">
                {matches.map((q) => (
                  <li key={q._id}>
                    <button onClick={() => setHighlightId(q._id)} aria-pressed={highlighted?._id === q._id}
                      className={`w-full rounded-xl border p-4 text-left card-hover ${highlighted?._id === q._id ? "border-brand bg-brandsoft" : "border-line bg-card hover:border-brand"}`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{q.title}</span>
                        <Badge tone={statusTone(q.status)}>{q.status}</Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted">{q.prompt}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={questionBadge(q).tone}>{questionBadge(q).label}</Badge>
                        {q.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <aside aria-label="Highlighted question" className="h-fit rounded-2xl border border-line bg-card p-5 lg:sticky lg:top-24 card-hover">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Highlighted question</h2>
          {!highlighted ? <p className="mt-3 text-sm text-muted">Search and select a question to highlight it here.</p> : (
            <>
              <h3 className="mt-2 font-display text-xl font-bold leading-snug">{highlighted.title}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={questionBadge(highlighted).tone}>{questionBadge(highlighted).label}</Badge>
                <Badge tone={statusTone(highlighted.status)}>{highlighted.status}</Badge>
                {highlighted.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{highlighted.prompt}</p>
              {highlighted.answer && (
                <details className="mt-4 rounded-lg bg-soft p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Answer (only you see this)</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{highlighted.answer}</p>
                </details>
              )}
              <p className="mt-3 text-xs text-muted">ID: {highlighted._id}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {highlighted.status !== "published"
                  ? <Btn onClick={() => act(highlighted, "publish")}>Publish</Btn>
                  : <Btn variant="ghost" onClick={() => act(highlighted, "draft")}>Move to draft</Btn>}
                <Btn variant="ghost" onClick={() => act(highlighted, "hide")}>Hide</Btn>
                <Btn href="/teacher/exams/new" variant="soft">Use in an exam</Btn>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
