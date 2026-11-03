"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Field, errCls, inputCls, Notice, useToast } from "./ui";
import { apiPatch, apiPost, ApiError } from "@/lib/api";
import { usePublicConfig } from "@/lib/hooks";
import { currencySymbol } from "@/lib/types";
import { checkTags, numOrNaN } from "@/lib/validation";

export interface ContentInitial {
  _id?: string; title?: string; description?: string; tags?: string[];
  visibility?: string; status?: string; price?: number; currency?: string;
  [key: string]: unknown;
}

type Errors = Record<string, string>;

/** Shared create/edit form for teacher content. Every invalid input shows a
 *  specific message under its field (plus a summary banner), and editing a
 *  field clears its error immediately. */
export function ContentForm({ kind, endpoint, initial, backHref }: {
  kind: "video" | "playlist" | "question" | "exam";
  endpoint: string; initial?: ContentInitial; backHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial?._id);
  const { config } = usePublicConfig();
  const currencies = config?.currencies ?? [];
  const defaultCurrency = config?.defaultCurrency ?? "";
  const [form, setForm] = useState<Record<string, string>>({
    title: String(initial?.title ?? ""), description: String(initial?.description ?? ""),
    tags: (initial?.tags ?? []).join(", "), visibility: String(initial?.visibility ?? "public"),
    status: String(initial?.status ?? "draft"), price: String(initial?.price ?? 0), currency: String(initial?.currency ?? ""),
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
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.currency && defaultCurrency && !initial?.currency) {
      setForm((f) => (f.currency ? f : { ...f, currency: defaultCurrency }));
    }
  }, [defaultCurrency, form.currency, initial]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: "" } : prev));
  };
  const lines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  const cls = (k: string) => `${inputCls}${errCls(errors[k])}`;

  const validate = (): Errors => {
    const errs: Errors = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    else if (form.title.trim().length > 200) errs.title = "Title must be 200 characters or less.";
    if (form.description.length > 5000) errs.description = "Description must be 5,000 characters or less.";
    const tagErr = checkTags(lines(form.tags));
    if (tagErr) errs.tags = tagErr;
    const price = numOrNaN(form.price);
    if (form.price.trim() !== "" && (Number.isNaN(price) || price < 0 || price > 1_000_000))
      errs.price = "Price must be between 0 and 1,000,000 (0 = free).";
    if (currencies.length && form.currency && !currencies.includes(form.currency))
      errs.currency = `Currency must be one of: ${currencies.join(", ")}.`;

    if (kind === "video" && form.sourceType === "youtube") {
      if (!form.youtubeId.trim()) errs.youtubeId = "YouTube video ID is required for a YouTube video.";
      else if (!/^[A-Za-z0-9_-]{11}$/.test(form.youtubeId.trim()))
        errs.youtubeId = "Enter a valid 11-character YouTube video ID (the part after watch?v=).";
    }
    if (kind === "playlist") {
      const ids = lines(form.videoIds);
      if (!ids.length) errs.videoIds = "Add at least one video ID (one per line).";
      else if (ids.some((x) => x.length > 100)) errs.videoIds = "Each video ID must be 100 characters or less.";
    }
    if (kind === "question") {
      if (!form.prompt.trim()) errs.prompt = "Prompt is required.";
      else if (form.prompt.length > 5000) errs.prompt = "Prompt must be 5,000 characters or less.";
      if (form.answer.length > 10000) errs.answer = "Answer must be 10,000 characters or less.";
      if (form.rubric.length > 10000) errs.rubric = "Rubric must be 10,000 characters or less.";
      if (form.linkedContentId.trim().length > 100) errs.linkedContentId = "Linked content ID must be 100 characters or less.";
    }
    if (kind === "exam") {
      const ids = lines(form.questionIds);
      if (!ids.length) errs.questionIds = "Add at least one question ID (one per line, in exam order).";
      else if (ids.some((x) => x.length > 100)) errs.questionIds = "Each question ID must be 100 characters or less.";
      const dur = numOrNaN(form.durationMinutes);
      if (form.durationMinutes.trim() === "") errs.durationMinutes = "Duration is required.";
      else if (!Number.isInteger(dur) || dur < 1 || dur > 1440) errs.durationMinutes = "Duration must be a whole number between 1 and 1440 minutes.";
      const pass = numOrNaN(form.passingMarks);
      if (form.passingMarks.trim() !== "" && (Number.isNaN(pass) || pass < 0))
        errs.passingMarks = "Passing marks must be 0 or more (and not exceed the questions' total marks).";
      if (form.videoId.trim().length > 100) errs.videoId = "Video ID must be 100 characters or less.";
      if (form.playlistId.trim().length > 100) errs.playlistId = "Playlist ID must be 100 characters or less.";
      if (form.startsAt && form.endsAt) {
        const s = new Date(form.startsAt); const en = new Date(form.endsAt);
        if (Number.isNaN(s.getTime())) errs.startsAt = "Starts at must be a valid date and time.";
        if (Number.isNaN(en.getTime())) errs.endsAt = "Ends at must be a valid date and time.";
        else if (!Number.isNaN(s.getTime()) && en.getTime() <= s.getTime()) errs.endsAt = "Ends at must be after Starts at.";
      }
    }
    return errs;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) { setError("Please fix the highlighted fields below."); return; }
    setError("");
    const price = numOrNaN(form.price);
    const base = {
      title: form.title.trim(), description: form.description, tags: lines(form.tags),
      visibility: form.visibility, status: form.status,
      price: Number.isNaN(price) ? 0 : price, currency: form.currency || defaultCurrency || undefined,
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
      } : {};

    setBusy(true);
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
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-4 rounded-2xl border border-line bg-card p-6 card-hover">
      {error && <Notice tone="red">{error}</Notice>}
      <Field label="Title" error={errors.title}><input className={cls("title")} value={form.title} onChange={set("title")} placeholder={`Your ${kind} title`} aria-invalid={!!errors.title} /></Field>
      <Field label="Description" error={errors.description}><textarea rows={3} className={cls("description")} value={form.description} onChange={set("description")} aria-invalid={!!errors.description} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tags" error={errors.tags} hint={errors.tags ? undefined : "Comma separated, e.g. algebra, basics"}><input className={cls("tags")} value={form.tags} onChange={set("tags")} aria-invalid={!!errors.tags} /></Field>
        <Field label="Currency" error={errors.currency}>
          <select className={cls("currency")} value={form.currency} onChange={set("currency")} aria-invalid={!!errors.currency}>
            {currencies.length === 0 && <option value="">{form.currency || "Loading…"}</option>}
            {currencies.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}
          </select>
        </Field>
        <Field label="Price (0 = free)" error={errors.price}><input type="number" min={0} className={cls("price")} value={form.price} onChange={set("price")} aria-invalid={!!errors.price} /></Field>
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
          {form.sourceType === "youtube" && <Field label="YouTube video ID" error={errors.youtubeId} hint={errors.youtubeId ? undefined : "The part after watch?v="}><input className={cls("youtubeId")} value={form.youtubeId} onChange={set("youtubeId")} placeholder="dQw4w9WgXcQ" aria-invalid={!!errors.youtubeId} /></Field>}
        </div>
      )}
      {kind === "playlist" && <Field label="Video IDs" error={errors.videoIds} hint={errors.videoIds ? undefined : "One ID per line. Copy IDs from your Videos page."}><textarea rows={4} className={cls("videoIds")} value={form.videoIds} onChange={set("videoIds")} aria-invalid={!!errors.videoIds} /></Field>}
      {kind === "question" && (
        <>
          <Field label="Question type">
            <select className={inputCls} value={form.type} onChange={set("type")}>
              <option value="mcq">MCQ</option><option value="short">Short answer</option><option value="code">Code</option>
            </select>
          </Field>
          <Field label="Prompt" error={errors.prompt}><textarea rows={4} className={cls("prompt")} value={form.prompt} onChange={set("prompt")} aria-invalid={!!errors.prompt} /></Field>
          <Field label="Answer (hidden from students)" error={errors.answer} hint={errors.answer ? undefined : "Students never see this in lists."}><textarea rows={3} className={cls("answer")} value={form.answer} onChange={set("answer")} aria-invalid={!!errors.answer} /></Field>
          <Field label="Rubric" error={errors.rubric}><textarea rows={3} className={cls("rubric")} value={form.rubric} onChange={set("rubric")} aria-invalid={!!errors.rubric} /></Field>
          <Field label="Linked content ID (optional)" error={errors.linkedContentId}><input className={cls("linkedContentId")} value={form.linkedContentId} onChange={set("linkedContentId")} aria-invalid={!!errors.linkedContentId} /></Field>
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
            <Field label="Passing marks" error={errors.passingMarks} hint={errors.passingMarks ? undefined : "Must not exceed the questions' total marks."}><input type="number" min={0} className={cls("passingMarks")} value={form.passingMarks} onChange={set("passingMarks")} aria-invalid={!!errors.passingMarks} /></Field>
            <Field label="Video ID (optional)" error={errors.videoId} hint={errors.videoId ? undefined : "YouTube video ID or your own video ID."}><input className={cls("videoId")} value={form.videoId} onChange={set("videoId")} maxLength={100} aria-invalid={!!errors.videoId} /></Field>
            <Field label="Playlist ID (optional)" error={errors.playlistId}><input className={cls("playlistId")} value={form.playlistId} onChange={set("playlistId")} maxLength={100} aria-invalid={!!errors.playlistId} /></Field>
          </div>
          <Field label="Question IDs" error={errors.questionIds} hint={errors.questionIds ? undefined : "One question ID per line, in exam order. Copy from Questions."}><textarea rows={4} className={cls("questionIds")} value={form.questionIds} onChange={set("questionIds")} aria-invalid={!!errors.questionIds} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)" error={errors.durationMinutes}><input type="number" min={1} max={1440} className={cls("durationMinutes")} value={form.durationMinutes} onChange={set("durationMinutes")} aria-invalid={!!errors.durationMinutes} /></Field>
            <Field label="Max attempts"><select className={inputCls} value={form.maxAttempts} onChange={set("maxAttempts")}>{Array.from({ length: 20 }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{n}</option>)}<option value="unlimited">No bound</option></select></Field>
            <Field label="Access policy">
              <select className={inputCls} value={form.accessPolicy} onChange={set("accessPolicy")}>
                <option value="free">Free</option><option value="paid">Paid</option><option value="enrolled">Enrolled</option>
              </select>
            </Field>
            <Field label="Starts at (optional)" error={errors.startsAt}><input type="datetime-local" className={cls("startsAt")} value={form.startsAt} onChange={set("startsAt")} aria-invalid={!!errors.startsAt} /></Field>
            <Field label="Ends at (optional)" error={errors.endsAt}><input type="datetime-local" className={cls("endsAt")} value={form.endsAt} onChange={set("endsAt")} aria-invalid={!!errors.endsAt} /></Field>
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Btn type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : `Create ${kind}`}</Btn>
        <Btn href={backHref} variant="ghost">Cancel</Btn>
      </div>
    </form>
  );
}
