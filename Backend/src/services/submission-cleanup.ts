import { ExamAttempt, Upload } from "../models/index.js";
import { storage } from "./storage.js";
import { logger } from "../common/logger.js";

const OBJECT_ID_RX = /^[a-f0-9]{24}$/i;

/** Upload ids referenced by an exam attempt's answers (answer PDF + slot files). */
export function attemptUploadIds(answers: any): string[] {
  if (!answers || typeof answers !== "object") return [];
  const out = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v === "string" && OBJECT_ID_RX.test(v.trim())) out.add(v.trim());
  };
  push((answers as any)._pdfUploadId);
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    if (k === "_pdfUploadId" || k === "_pdfName" || k.endsWith("_fileName")) continue;
    push(v);
  }
  return [...out];
}

/**
 * Delete superseded (ungraded) attempts and their uploaded files.
 * Callers pass only ungraded docs — graded history is permanent and must never
 * be included. An uploaded file (Upload doc + stored bytes, incl. PDFs) is
 * removed only when it belongs to the student, is an assignment-purpose
 * upload, and no remaining attempt still references it.
 * Never throws — cleanup must not fail an already-recorded submission.
 */
export async function deleteSuperseded(
  studentId: string,
  attempts: any[],
): Promise<void> {
  try {
    const attemptIds = attempts.map((a) => String(a._id ?? a.id)).filter(Boolean);
    const candidateUploads = new Set<string>();
    for (const a of attempts) for (const u of attemptUploadIds((a as any).answers)) candidateUploads.add(u);
    if (attemptIds.length) await ExamAttempt.deleteMany({ _id: { $in: attemptIds }, studentId }).catch(() => undefined);
    if (!candidateUploads.size) return;
    // Keep any file still referenced by remaining work.
    const stillUsed = new Set<string>();
    const remaining: any[] = await ExamAttempt.find({ studentId }).select("answers").lean().catch(() => []);
    for (const u of candidateUploads) {
      if (remaining.some((x) => attemptUploadIds((x as any).answers).includes(u))) stillUsed.add(u);
    }
    const removable = [...candidateUploads].filter((u) => !stillUsed.has(u));
    if (!removable.length) return;
    const docs: any[] = await Upload.find({ _id: { $in: removable }, ownerId: studentId, purpose: "assignment" }).lean().catch(() => []);
    for (const d of docs) {
      const key = String((d as any).storageKey ?? "");
      if (key) await storage.delete(key).catch(() => undefined);
    }
    if (docs.length) await Upload.deleteMany({ _id: { $in: docs.map((d) => String(d._id)) } }).catch(() => undefined);
  } catch (e) {
    logger.warn({ submissionCleanupError: (e as Error)?.message }, "superseded attempt cleanup failed");
  }
}
