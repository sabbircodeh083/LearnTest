"use client";
import { useState } from "react";
import { QuestionCard } from "@/components/cards";
import { Btn, Empty, ErrorBox, inputCls, PageHead } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { Page, Question } from "@/lib/types";

export default function StudentQuestionsPage() {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12;
  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<Question>>(`/api/v1/questions${qs({ search: submitted, page, limit })}`), [submitted, page]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div>
      <PageHead title="Questions" sub="Browse published questions. Open one to see the full prompt and check access before you rely on it." />
      <form role="search" className="mb-6 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSubmitted(search.trim()); }}>
        <label className="sr-only" htmlFor="all-q">Search by title or #tag</label>
        <input id="all-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or #tag…" className={inputCls} />
        <Btn type="submit">Search</Btn>
        {submitted && <Btn variant="ghost" onClick={() => { setSearch(""); setSubmitted(""); setPage(1); }}>Clear</Btn>}
      </form>
      {loading ? <p className="text-sm text-muted" aria-busy="true">Loading questions…</p> :
        error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No questions found" body={submitted ? `Nothing matched “${submitted}”.` : "No published questions yet."} /> : (
          <>
            <p className="mb-4 text-sm text-muted">{data.total} question{data.total === 1 ? "" : "s"}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((q) => <QuestionCard key={q._id} question={q} />)}</div>
            <div className="mt-6 flex items-center gap-3">
              <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              <Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
            </div>
          </>
        )}
    </div>
  );
}
