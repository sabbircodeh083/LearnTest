"use client";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Btn, ErrorBox, Field, inputCls, Loading, Notice, PageHead, statusTone, useToast } from "@/components/ui";
import { BuyPanel } from "@/components/purchase";
import { apiBlobUrl, apiDownload, apiGet, apiPost, apiUpload, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { RateDialog } from "@/components/RateDialog";
import { fmtDate, scanLabel, type Assignment, type Page, type Submission, type UploadDoc } from "@/lib/types";

/* PDF opener shown inside the details page for a previously submitted file. */
function SubmittedFile({ uploadId, fallbackName }: { uploadId: string; fallbackName: string }) {
  const toast = useToast();
  const [filename, setFilename] = useState(fallbackName);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<UploadDoc>(`/api/v1/uploads/${uploadId}`)
      .then((doc) => { if (alive && doc?.filename) setFilename(doc.filename); })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, [uploadId]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const isPdf = /\.pdf$/i.test(filename);

  const view = async () => {
    if (url) { setOpen((o) => !o); return; }
    setBusy(true);
    try {
      const u = await apiBlobUrl(`/api/v1/uploads/${uploadId}/download`);
      setUrl(u);
      setOpen(true);
    } catch {
      toast("This file is not available.", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {isPdf && (
          <button
            type="button"
            onClick={() => void view()}
            disabled={busy}
            className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff] disabled:opacity-50"
          >
            {open ? "Hide PDF" : busy ? "Opening…" : "Open PDF"}
          </button>
        )}
        <button
          type="button"
          onClick={() => apiDownload(`/api/v1/uploads/${uploadId}/download`, filename || fallbackName).catch((e) => toast(e.message, "err"))}
          className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium hover:bg-soft"
        >
          Download
        </button>
      </div>
      {open && url && (
        <iframe src={url} title={`Submitted file ${filename}`} className="mt-2 h-[480px] w-full rounded-lg border border-line bg-card" />
      )}
    </div>
  );
}

function MyAssignmentSubmissions({ assignmentId, refreshKey, showFeedback }: { assignmentId: string; refreshKey: number; showFeedback: boolean }) {
  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<Submission>>(`/api/v1/submissions/me${qs({ limit: 50 })}`),
    [assignmentId, refreshKey],
  );
  const rows = (data?.items ?? []).filter((s) => String(s.assignmentId) === String(assignmentId));
  if (loading) return <Loading label="Loading your submissions…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!rows.length) return <p className="mt-2 text-sm text-muted">No submissions yet for this test.</p>;
  return (
    <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
      {rows.map((s) => (
        <li key={String(s._id)} className="p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Submitted {fmtDate(s.createdAt)}</span>
            <Badge tone={statusTone(s.state)}>{s.state.replace(/_/g, " ")}</Badge>
          </p>
          {(s.repoUrl || s.liveUrl) && (
            <div className="mt-1 space-y-0.5 text-[13px]">
              {s.repoUrl && <p className="break-all">Git: <a className="font-medium text-[#1d6ce0] underline" href={s.repoUrl} target="_blank" rel="noreferrer">{s.repoUrl}</a></p>}
              {s.liveUrl && <p className="break-all">Live: <a className="font-medium text-[#1d6ce0] underline" href={s.liveUrl} target="_blank" rel="noreferrer">{s.liveUrl}</a></p>}
            </div>
          )}
          {s.uploadId && <SubmittedFile uploadId={String(s.uploadId)} fallbackName="submission.pdf" />}
          {showFeedback && (s.state === "graded" ? (
            <div className="mt-2 rounded-lg bg-soft p-3 text-sm">
              <p className="font-bold">Grade: {s.grade ?? "—"}</p>
              {s.feedback
                ? <p className="mt-1 whitespace-pre-wrap text-muted">{s.feedback}</p>
                : <p className="mt-1 text-muted">No written feedback.</p>}
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Awaiting review by your teacher.</p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function AssignmentDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const fromParam = search.get("from");
  const backHref =
    fromParam === "results" ? "/student/results"
    : fromParam === "saved" ? "/student/saved-content"
    : fromParam === "purchases" ? "/student/purchases"
    : fromParam === "home" ? "/student"
    : fromParam === "tests" ? "/student/my-exams"
    : "/student/assignments";
  const backLabel =
    fromParam === "results" ? "Results & Feedback"
    : fromParam === "saved" ? "Saved Content"
    : fromParam === "purchases" ? "Purchased Content"
    : fromParam === "home" ? "Home"
    : fromParam === "tests" ? "Tests"
    : "Assignments";
  const toast = useToast();
  const { data: a, error, loading, retry } = useFetch(() => apiGet<Assignment>(`/api/v1/assignments/${id}`), [id]);
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadDoc | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [testRating, setTestRating] = useState(0);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const mySubs = useFetch(() => apiGet<Page<Submission>>(`/api/v1/submissions/me${qs({ limit: 50 })}`), []);
  // The limit counts retained (graded) submissions — replacing ungraded work never consumes it.
  const usedCount = useMemo(
    () => (mySubs.data?.items ?? []).filter((s) => String(s.assignmentId) === String(id) && s.state === "graded").length,
    [mySubs.data, id],
  );

  if (loading) return <Loading label="Loading assignment…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!a) return <ErrorBox message="Assignment not found." onRetry={retry} />;

  const maxAttempts = a.maxAttempts ?? null;
  const exhausted = maxAttempts != null && usedCount >= maxAttempts;

  const doUpload = async () => {
    if (!file) { toast("Choose a PDF or ZIP file first.", "err"); return; }
    setBusy("upload");
    try {
      const doc = await apiUpload<UploadDoc>("/api/v1/uploads/assignment", file, { relatedId: a._id });
      setUpload(doc);
      toast("File uploaded. Scan state: " + scanLabel[doc.scanStatus]);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Upload failed.", "err"); }
    finally { setBusy(null); }
  };

  const refreshScan = async () => {
    if (!upload) return;
    setBusy("scan");
    try { setUpload(await apiGet<UploadDoc>(`/api/v1/uploads/${upload._id}`)); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not refresh scan state.", "err"); }
    finally { setBusy(null); }
  };

  const submit = async () => {
    setBusy("submit");
    try {
      await apiPost("/api/v1/submissions", {
        assignmentId: a._id, uploadId: upload?._id ?? null,
        repoUrl: repoUrl || undefined, liveUrl: liveUrl || undefined,
      });
      toast("Submission recorded. Track it in My Submissions.");
      window.location.href = "/student/submissions";
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not submit.", "err"); }
    finally { setBusy(null); }
  };

  const submitRating = async () => {
    if (!testRating) { setRateOpen(false); return; }
    setRateBusy(true);
    try {
      await apiPost("/api/v1/ratings", { targetType: "assignment", targetId: a._id, value: testRating });
      toast(`Thanks — you rated this test ${testRating}/5.`);
      setRateOpen(false);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save rating.", "err"); }
    finally { setRateBusy(false); }
  };

  return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-brandstrong">← {backLabel}</Link>
      <PageHead title={a.title} sub={a.dueAt ? `Due ${fmtDate(a.dueAt)} · Max score ${a.maxScore}` : `Max score ${a.maxScore}`} />
      <article className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Instructions</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{a.description || "No instructions provided."}</p>
        <div className="mt-5 border-t border-line pt-5"><BuyPanel contentType="assignment" contentId={a._id} price={a.price} currency={a.currency} /></div>
      </article>

      {exhausted ? (
        <p role="note" className="mt-6 rounded-2xl border border-line bg-soft px-6 py-5 text-center text-sm font-semibold text-muted">
          You have used all {maxAttempts} submission{maxAttempts === 1 ? "" : "s"}. Check Graded Submissions or Results & Feedback for your progress.
        </p>
      ) : (
      <section className="mt-6 rounded-2xl border border-line bg-card p-6" aria-label="Submit your work">
        <h2 className="font-display text-xl font-bold">Submit your work</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Upload a PDF or ZIP (checked by file signature, max size set by the server).</li>
          <li>Wait for the scan state. Pending, suspicious, infected, or failed files are not approved downloads.</li>
          <li>Create the submission so your teacher can grade it.</li>
        </ol>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Assignment file (PDF or ZIP)">
            <input type="file" accept=".pdf,.zip,application/pdf,application/zip" className={inputCls}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <div className="flex items-end"><Btn onClick={doUpload} disabled={busy !== null || !file}>{busy === "upload" ? "Uploading…" : "Upload file"}</Btn></div>
          <Field label="Repository URL (optional)"><input className={inputCls} value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/project" /></Field>
          <Field label="Live URL (optional)"><input className={inputCls} value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://your-demo.example.com" /></Field>
        </div>
        {upload && (
          <div className="mt-5 rounded-xl bg-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{upload.filename}</span>
              <Badge tone={statusTone(upload.scanStatus)}>{scanLabel[upload.scanStatus]}</Badge>
              <span className="text-xs text-muted">{(upload.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="ghost" onClick={refreshScan} disabled={busy !== null}>{busy === "scan" ? "Checking…" : "Refresh scan state"}</Btn>
              {(upload.scanStatus === "clean" || upload.scanStatus === "disabled") && (
                <Btn variant="ghost" onClick={() => apiDownload(`/api/v1/uploads/${upload._id}/download`, upload.filename).catch((e) => toast(e.message, "err"))}>Download uploaded file</Btn>
              )}
            </div>
            {upload.scanStatus !== "clean" && upload.scanStatus !== "disabled" && (
              <p className="mt-2 text-sm text-warn">This file is not an approved download yet because its scan state is “{scanLabel[upload.scanStatus].toLowerCase()}”.</p>
            )}
          </div>
        )}
        <Btn onClick={submit} disabled={busy !== null} className="mt-5">{busy === "submit" ? "Submitting…" : "Submit Project"}</Btn>
        {!upload && <p className="mt-2 text-xs text-muted">You can submit links without a file, but most assignments expect the uploaded file above.</p>}
      </section>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-card p-6" aria-label="My submissions for this test">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">My submissions</h2>
            <p className="mt-1 text-sm text-muted">Open a submitted PDF right here inside the details page.</p>
          </div>
          <Btn variant="ghost" onClick={() => setRateOpen(true)}>★ Rate this test</Btn>
        </div>
        <MyAssignmentSubmissions assignmentId={String(a._id)} refreshKey={submittedCount} showFeedback={fromParam === "results"} />
      </section>
      <RateDialog
        open={rateOpen}
        title="Rate this test"
        sub="How was this test overall? Your rating helps teachers improve."
        value={testRating}
        busy={rateBusy}
        onPick={setTestRating}
        onClose={() => setRateOpen(false)}
        onSubmit={submitRating}
      />
    </div>
  );
}

export default function AssignmentDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Loading assignment…" />}>
      <AssignmentDetailInner params={params} />
    </Suspense>
  );
}
