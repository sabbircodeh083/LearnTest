"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Btn, Empty, ErrorBox, inputCls, Loading, PageHead, statusTone, useToast } from "@/components/ui";
import { ContentForm } from "@/components/ContentForm";
import { apiDelete, apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Assignment, type Page, type Submission } from "@/lib/types";

export default function TeacherAssignmentsPage() {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const list = useFetch(() => apiGet<Page<Assignment>>(`/api/v1/assignments${qs({ mine: 1, limit: 30 })}`), []);
  const subs = useFetch(
    () => selected ? apiGet<Page<Submission>>(`/api/v1/assignments/${selected._id}/submissions?limit=30`) : Promise.resolve({ items: [], total: 0 } as Page<Submission>),
    [selected?._id]);
  const [grades, setGrades] = useState<Record<string, { grade: string; feedback: string }>>({});

  const gradeSubmission = async (s: Submission) => {
    const g = grades[s._id];
    if (!g?.grade) { toast("Enter a grade first.", "err"); return; }
    try {
      await apiPatch(`/api/v1/submissions/${s._id}/grade`, { grade: Number(g.grade), feedback: g.feedback ?? "" });
      toast("Submission graded."); subs.retry();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not grade.", "err"); }
  };
  const gradeAttemptPrompt = () => toast("Grade exam attempts from Students — open the student attempt there.");

  return (
    <div>
      <PageHead title="Assignments" sub="Create assignments, then open one to review and grade its submissions."
        action={<Btn onClick={() => setCreating((c) => !c)}>{creating ? "Close form" : "New assignment"}</Btn>} />
      {creating && <div className="mb-6"><ContentForm kind="assignment" endpoint="/api/v1/assignments" backHref="/teacher/assignments" /></div>}
      {list.loading ? <Loading label="Loading assignments…" /> : list.error ? <ErrorBox message={list.error} onRetry={list.retry} /> :
        !list.data?.items.length ? <Empty title="No assignments yet" body="Create your first assignment above." /> : (
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <ul className="space-y-3">
              {list.data.items.map((a) => (
                <li key={a._id} className="flex items-start gap-2">
                  <button onClick={() => setSelected(a)} aria-pressed={selected?._id === a._id}
                    className={`w-full rounded-xl border p-4 text-left ${selected?._id === a._id ? "border-brand bg-brandsoft" : "border-line bg-card"}`}>
                    <span className="flex justify-between gap-2"><span className="font-semibold">{a.title}</span><Badge tone={statusTone(a.status)}>{a.status}</Badge></span>
                    <span className="mt-1 block text-sm text-muted">Max {a.maxScore}{a.dueAt ? ` · Due ${fmtDate(a.dueAt)}` : ""} · ID {a._id}</span>
                  </button>
                  <Link href={`/teacher/exams/${a._id}/edit`} aria-label={`Edit ${a.title}`}
                    className="mt-3 shrink-0 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-[#16a34a] hover:bg-[#e6f9ec]">Edit</Link>
                </li>
              ))}
            </ul>
            <section className="h-fit rounded-2xl border border-line bg-card p-5" aria-label="Submissions to grade">
              <h2 className="font-display text-lg font-bold">{selected ? `Submissions — ${selected.title}` : "Submissions"}</h2>
              {!selected ? <p className="mt-2 text-sm text-muted">Select an assignment to see who submitted and grade their work.</p> :
                subs.loading ? <p className="mt-2 text-sm text-muted">Loading submissions…</p> :
                subs.error ? <ErrorBox message={subs.error} onRetry={subs.retry} /> :
                !subs.data?.items.length ? <p className="mt-2 text-sm text-muted">No submissions yet for this assignment.</p> : (
                  <ul className="mt-3 space-y-4">
                    {subs.data.items.map((s) => (
                      <li key={s._id} className="rounded-lg border border-line p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(s.state)}>{s.state.replace("_", " ")}</Badge>
                          <span className="text-xs text-muted">{fmtDate(s.createdAt)} · Student {s.studentId.slice(0, 8)}…</span>
                        </div>
                        {s.repoUrl && <p className="mt-1 break-all text-xs"><a className="text-brandstrong underline" href={s.repoUrl} target="_blank" rel="noreferrer">{s.repoUrl}</a></p>}
                        {s.liveUrl && <p className="break-all text-xs"><a className="text-brandstrong underline" href={s.liveUrl} target="_blank" rel="noreferrer">{s.liveUrl}</a></p>}
                        <div className="mt-3 grid gap-2">
                          <label className="text-xs font-semibold">Grade (max {selected.maxScore})
                            <input type="number" className={inputCls} value={grades[s._id]?.grade ?? (s.grade ?? "")}
                              onChange={(e) => setGrades((g) => ({ ...g, [s._id]: { grade: e.target.value, feedback: g[s._id]?.feedback ?? s.feedback ?? "" } }))} />
                          </label>
                          <label className="text-xs font-semibold">Feedback
                            <textarea rows={2} className={inputCls} value={grades[s._id]?.feedback ?? s.feedback ?? ""}
                              onChange={(e) => setGrades((g) => ({ ...g, [s._id]: { grade: g[s._id]?.grade ?? "", feedback: e.target.value } }))} />
                          </label>
                          <Btn onClick={() => gradeSubmission(s)}>Save grade</Btn>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              <Btn variant="ghost" className="mt-4" onClick={gradeAttemptPrompt}>About exam grading</Btn>
            </section>
          </div>
        )}
    </div>
  );
}
