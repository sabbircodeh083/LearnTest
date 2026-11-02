"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Field, inputCls, Notice, useToast } from "./ui";
import { apiPatch, apiPost, ApiError } from "@/lib/api";

export interface ContentInitial {
  _id?: string; title?: string; description?: string; tags?: string[];
  visibility?: string; status?: string; price?: number; currency?: string;
  [key: string]: unknown;
}

/** Shared create/edit form for teacher content. Extra fields render per kind. */
export function ContentForm({ kind, endpoint, initial, backHref }: {
  kind: "video" | "playlist" | "question" | "exam" | "assignment";
  endpoint: string; initial?: ContentInitial; backHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial?._id);
  const [form, setForm] = useState<Record<string, string>>({
    title: String(initial?.title ?? ""), description: String(initial?.description ?? ""),
    tags: (initial?.tags ?? []).join(", "), visibility: String(initial?.visibility ?? "public"),
    status: String(initial?.status ?? "draft"), price: String(initial?.price ?? 0), currency: String(initial?.currency ?? "BDT"),
    sourceType: String(initial?.sourceType ?? "youtube"), youtubeId: String(initial?.youtubeId ?? ""),
    videoIds: Array.isArray(initial?.videoIds) ? (initial!.videoIds as string[]).join("\n") : "",
    type: String(initial?.type ?? "mcq"), prompt: String(initial?.prompt ?? ""), answer: String(initial?.answer ?? ""), rubric: String(initial?.rubric ?? ""),
    questionIds: Array.isArray(initial?.questionIds) ? (initial!.questionIds as string[]).join("\n") : "",
    durationMinutes: String(initial?.durationMinutes ?? 30), maxAttempts: initial?.maxAttempts === null ? "unlimited" : String(initial?.maxAttempts ?? 1),
    accessPolicy: String(initial?.accessPolicy ?? "free"),
    kind: String(initial?.kind ?? "quiz"), passingMarks: String(initial?.passingMarks ?? 0),
    playlistId: String(initial?.playlistId ?? ""), videoId: String(initial?.videoId ?? ""),
    startsAt: initial?.startsAt ? String(initial.startsAt).slice(0, 16) : "", endsAt: initial?.endsAt ? String(initial.endsAt).slice(0, 16) : "",
    dueAt: initial?.dueAt ? String(initial.dueAt).slice(0, 16) : "", maxScore: String(initial?.maxScore ?? 100),
    linkedContentId: String(initial?.linkedContentId ?? ""),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const lines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (kind === "question" && !form.prompt.trim()) { setError("Prompt is required."); return; }
    if (kind === "exam" && (!form.durationMinutes || Number(form.durationMinutes) < 1)) { setError("Duration must be at least 1 minute."); return; }
    const base = {
      title: form.title.trim(), description: form.description, tags: lines(form.tags),
      visibility: form.visibility, status: form.status,
      price: Number(form.price) || 0, currency: form.currency || "BDT",
    };
    const extra: Record<string, unknown> =
      kind === "video" ? { sourceType: form.sourceType, youtubeId: form.sourceType === "youtube" ? form.youtubeId.trim() : "", assetUploadId: null } :
      kind === "playlist" ? { videoIds: lines(form.videoIds) } :
      kind === "question" ? { type: form.type, prompt: form.prompt, answer: form.answer, rubric: form.rubric, linkedContentId: form.linkedContentId || null } :
      kind === "exam" ? {
        questionIds: lines(form.questionIds), durationMinutes: Number(form.durationMinutes),
        maxAttempts: form.maxAttempts === "unlimited" ? null : (Number(form.maxAttempts) || 1), accessPolicy: form.accessPolicy,
        kind: form.kind, passingMarks: Number(form.passingMarks) || 0,
        playlistId: form.playlistId.trim() || null, videoId: form.videoId.trim(),
        ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
        ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
      } : {
        // Creation schema takes an optional datetime string; the edit schema is
        // nullable so clearing the field removes the deadline.
        ...(form.dueAt ? { dueAt: new Date(form.dueAt).toISOString() } : editing ? { dueAt: null } : {}),
        maxScore: Number(form.maxScore) || 100, maxAttempts: form.maxAttempts === "unlimited" ? null : Math.min(20, Math.max(1, Number(form.maxAttempts) || 1)),
      };

    setBusy(true); setError("");
    try {
      if (editing) await apiPatch(`${endpoint}/${initial!._id}`, { ...base, ...extra });
      else await apiPost(endpoint, { ...base, ...extra });
      toast(editing ? "Saved." : "Created. Publish it from the list when you are ready.");
      router.push(backHref);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Check the fields and try again.");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-2xl border border-line bg-card p-6">
      {error && <Notice tone="red">{error}</Notice>}
      <Field label="Title"><input className={inputCls} value={form.title} onChange={set("title")} placeholder={`Your ${kind} title`} /></Field>
      <Field label="Description"><textarea rows={3} className={inputCls} value={form.description} onChange={set("description")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tags" hint="Comma separated, e.g. algebra, basics"><input className={inputCls} value={form.tags} onChange={set("tags")} /></Field>
        <Field label="Currency"><input className={inputCls} maxLength={3} value={form.currency} onChange={set("currency")} /></Field>
        <Field label="Price (0 = free)"><input type="number" min={0} className={inputCls} value={form.price} onChange={set("price")} /></Field>
        <Field label="Visibility">
          <select className={inputCls} value={form.visibility} onChange={set("visibility")}>
            <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={set("status")}>
            <option value="draft">Draft</option><option value="published">Published</option>
          </select>
        </Field>
      </div>

      {kind === "video" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source">
            <select className={inputCls} value={form.sourceType} onChange={set("sourceType")}>
              <option value="youtube">YouTube</option><option value="upload">Upload (link after upload)</option>
            </select>
          </Field>
          {form.sourceType === "youtube" && <Field label="YouTube video ID" hint="The part after watch?v="><input className={inputCls} value={form.youtubeId} onChange={set("youtubeId")} placeholder="dQw4w9WgXcQ" /></Field>}
        </div>
      )}
      {kind === "playlist" && <Field label="Video IDs" hint="One ID per line. Copy IDs from your Videos page."><textarea rows={4} className={inputCls} value={form.videoIds} onChange={set("videoIds")} /></Field>}
      {kind === "question" && (
        <>
          <Field label="Question type">
            <select className={inputCls} value={form.type} onChange={set("type")}>
              <option value="mcq">MCQ</option><option value="short">Short answer</option><option value="code">Code</option>
            </select>
          </Field>
          <Field label="Prompt"><textarea rows={4} className={inputCls} value={form.prompt} onChange={set("prompt")} /></Field>
          <Field label="Answer (hidden from students)" hint="Students never see this in lists."><textarea rows={3} className={inputCls} value={form.answer} onChange={set("answer")} /></Field>
          <Field label="Rubric"><textarea rows={3} className={inputCls} value={form.rubric} onChange={set("rubric")} /></Field>
          <Field label="Linked content ID (optional)"><input className={inputCls} value={form.linkedContentId} onChange={set("linkedContentId")} /></Field>
        </>
      )}
      {kind === "exam" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test kind">
              <select className={inputCls} value={form.kind} onChange={set("kind")}>
                <option value="quiz">Quiz</option><option value="written">Written</option><option value="problem">Problem Solving</option><option value="project">Project</option>
              </select>
            </Field>
            <Field label="Passing marks" hint="Must not exceed the questions' total marks."><input type="number" min={0} className={inputCls} value={form.passingMarks} onChange={set("passingMarks")} /></Field>
            <Field label="Video ID (optional)" hint="YouTube video ID or your own video ID."><input className={inputCls} value={form.videoId} onChange={set("videoId")} maxLength={100} /></Field>
            <Field label="Playlist ID (optional)"><input className={inputCls} value={form.playlistId} onChange={set("playlistId")} maxLength={100} /></Field>
          </div>
          <Field label="Question IDs" hint="One question ID per line, in exam order. Copy from Questions."><textarea rows={4} className={inputCls} value={form.questionIds} onChange={set("questionIds")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)"><input type="number" min={1} max={1440} className={inputCls} value={form.durationMinutes} onChange={set("durationMinutes")} /></Field>
            <Field label="Max attempts"><select className={inputCls} value={form.maxAttempts} onChange={set("maxAttempts")}>{Array.from({ length: 20 }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{n}</option>)}<option value="unlimited">No bound</option></select></Field>
            <Field label="Access policy">
              <select className={inputCls} value={form.accessPolicy} onChange={set("accessPolicy")}>
                <option value="free">Free</option><option value="paid">Paid</option><option value="enrolled">Enrolled</option>
              </select>
            </Field>
            <Field label="Starts at (optional)"><input type="datetime-local" className={inputCls} value={form.startsAt} onChange={set("startsAt")} /></Field>
            <Field label="Ends at (optional)"><input type="datetime-local" className={inputCls} value={form.endsAt} onChange={set("endsAt")} /></Field>
          </div>
        </>
      )}
      {kind === "assignment" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due at (optional)"><input type="datetime-local" className={inputCls} value={form.dueAt} onChange={set("dueAt")} /></Field>
          <Field label="Max score"><input type="number" min={1} className={inputCls} value={form.maxScore} onChange={set("maxScore")} /></Field>
          <Field label="Max attempts"><select className={inputCls} value={form.maxAttempts} onChange={set("maxAttempts")}>{Array.from({ length: 20 }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{n}</option>)}<option value="unlimited">No bound</option></select></Field>
        </div>
      )}
      <div className="flex gap-2">
        <Btn type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : `Create ${kind}`}</Btn>
        <Btn href={backHref} variant="ghost">Cancel</Btn>
      </div>
    </form>
  );
}
