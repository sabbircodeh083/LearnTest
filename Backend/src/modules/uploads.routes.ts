import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncHandler, ok, p } from "../common/middleware.js";
import { badRequest, forbidden, notFound } from "../common/errors.js";
import { requireRole } from "../auth/guards.js";
import { Exam, ExamAttempt, Upload } from "../models/index.js";
import { storage, quarantineKey, approvedKey } from "../services/storage.js";
import { BouncerClient, scanUploadDoc } from "../services/malware-scan.js";

export const PURPOSE_RULES: Record<string, { exts: string[]; mimes: string[] }> = {
  assignment: { exts: [".pdf", ".zip"], mimes: ["application/pdf", "application/zip"] },
  content: { exts: [".pdf", ".mp4", ".png", ".jpg", ".jpeg", ".webp"], mimes: ["application/pdf", "video/mp4", "application/mp4", "image/png", "image/jpeg", "image/webp"] },
  avatar: { exts: [".png", ".jpg", ".jpeg", ".webp"], mimes: ["image/png", "image/jpeg", "image/webp"] },
  cover: { exts: [".png", ".jpg", ".jpeg", ".webp"], mimes: ["image/png", "image/jpeg", "image/webp"] },
};
// Magic-byte check: detected type must match declared MIME and extension family. SVG is never allowed (script risk).
export function mimeMatchesExt(mime: string, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string[]> = { ".pdf": ["application/pdf"], ".png": ["image/png"], ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".webp": ["image/webp"], ".mp4": ["video/mp4", "application/mp4"], ".zip": ["application/zip", "application/x-zip-compressed"] };
  return (map[ext] ?? []).includes(mime);
}
/** Downloadable only after a clean scan, or when scanning is explicitly disabled (never pending/failed/infected). */
export const isDownloadable = (scanStatus: string) => scanStatus === "clean" || scanStatus === "disabled";

/** Per-type category derived from magic-byte detected MIME. */
export type UploadKind = "pdf" | "zip" | "video" | "image";
export function kindOfMime(mime: string): UploadKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return "zip";
  if (mime === "video/mp4" || mime === "application/mp4") return "video";
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp") return "image";
  return null;
}

/** Size limit in bytes for a detected MIME. */
export function sizeLimitForMime(mime: string): number {
  const kind = kindOfMime(mime);
  if (kind === "pdf") return env.MAX_PDF_SIZE_MB * 1024 * 1024;
  if (kind === "zip") return env.MAX_ZIP_SIZE_MB * 1024 * 1024;
  if (kind === "video") return env.MAX_VIDEO_SIZE_MB * 1024 * 1024;
  if (kind === "image") return env.MAX_IMAGE_SIZE_MB * 1024 * 1024;
  return 0;
}

/** Human label for a MIME kind, used in error messages. */
export function labelForMime(mime: string): string {
  const kind = kindOfMime(mime);
  if (kind === "pdf") return "PDF";
  if (kind === "zip") return "ZIP";
  if (kind === "video") return "Video";
  if (kind === "image") return "Image";
  return "File";
}

// Multer caps per purpose: fileSize must be the MAX of the types that purpose
// accepts (multer runs before magic-byte detection), the exact per-type limit
// is enforced again in handleUpload() after fileTypeFromFile().
function multerLimitsForPurpose(purpose: string): { fileSize: number; files: number } {
  if (purpose === "assignment")
    return {
      fileSize: Math.max(env.MAX_PDF_SIZE_MB, env.MAX_ZIP_SIZE_MB) * 1024 * 1024,
      files: Math.max(env.MAX_PDF_FILES, env.MAX_ZIP_FILES),
    };
  if (purpose === "content")
    return {
      fileSize: Math.max(env.MAX_PDF_SIZE_MB, env.MAX_VIDEO_SIZE_MB, env.MAX_IMAGE_SIZE_MB) * 1024 * 1024,
      files: Math.max(env.MAX_PDF_FILES, env.MAX_VIDEO_FILES, env.MAX_IMAGE_FILES),
    };
  // avatar / cover accept images only
  return { fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024, files: env.MAX_IMAGE_FILES };
}

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(path.join(uploadDir, "tmp"), { recursive: true });
function makeUploader(purpose: string) {
  const limits = multerLimitsForPurpose(purpose);
  return multer({
    dest: path.join(uploadDir, "tmp"),
    limits: { fileSize: limits.fileSize, files: limits.files, fields: 10, fieldSize: 100 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/\.(exe|sh|bat|js|mjs|html?|svg|php)$/i.test(file.originalname) || file.originalname.includes("..")) return cb(new Error("Disallowed file name/type"));
      cb(null, true);
    },
  });
}

async function handleUpload(req: any, purpose: string, scanner?: BouncerClient) {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw badRequest("File required");
  try {
    const fields = z.object({ relatedId: z.string().max(100).optional() }).parse(req.body ?? {});
    // Test-file uploads must attach to the caller's own attempt — never to
    // another student's attempt or another teacher's review queue.
    if (purpose === "assignment" && fields.relatedId) {
      const attempt: any = await ExamAttempt.findById(fields.relatedId).select("studentId").lean().catch(() => null);
      if (!attempt || (String(attempt.studentId) !== req.user.id && req.user.role !== "admin"))
        throw badRequest("relatedId must be your own test attempt.");
    }
    const rules = PURPOSE_RULES[purpose]!;
    const ext = path.extname(file.originalname).toLowerCase();
    if (!rules.exts.includes(ext)) throw badRequest(`Extension ${ext} not allowed for ${purpose}`);
    const detected = await fileTypeFromFile(file.path).catch(() => undefined);
    if (!detected || !rules.mimes.includes(detected.mime) || !mimeMatchesExt(detected.mime, file.originalname)) throw badRequest("File content does not match declared type");
    // NOTE: the browser-declared MIME (file.mimetype) is NOT trusted — browsers
    // report .mp4 inconsistently ("", "application/octet-stream", "video/mpeg",
    // "application/mp4", ...). Magic-byte detection above is the ground truth.
    // Per-type size limit (exact kind is only known after magic-byte detection).
    const limit = sizeLimitForMime(detected.mime);
    if (limit > 0 && file.size > limit) {
      const label = labelForMime(detected.mime);
      const maxMb = Math.round((limit / (1024 * 1024)) * 10) / 10;
      const gotMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
      throw badRequest(`${label} too large: ${gotMb} MB exceeds the ${maxMb} MB limit.`);
    }
    const bytes = await fs.promises.readFile(file.path);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const baseKey = `${purpose}/${randomUUID()}${ext}`; // server-side key, never the user filename
    const enabled = env.MALWARE_SCAN_ENABLED;
    // Fail closed: with scanning on, bytes land ONLY in private quarantine until a clean verdict promotes them.
    const storageKey = enabled ? quarantineKey(baseKey) : approvedKey(quarantineKey(baseKey));
    await storage.put(storageKey, bytes, detected.mime);
    const doc: any = await Upload.create({ ownerId: req.user.id, storageKey, filename: path.basename(file.originalname).slice(0, 255), detectedMime: detected.mime, size: file.size, checksum, purpose, relatedId: fields.relatedId ?? null, scanStatus: enabled ? "pending_scan" : "disabled", scanProvider: enabled ? env.MALWARE_SCAN_PROVIDER : "" });
    if (enabled) {
      // Async scan (Bouncer is async); response stays pending_scan. Clean -> promote, anything else stays quarantined.
      void (async () => {
        const status = await scanUploadDoc(doc, bytes, scanner ?? new BouncerClient());
        if (status === "clean") { doc.storageKey = await storage.promote(doc.storageKey); await doc.save(); }
      })().catch(() => undefined); // scanUploadDoc already records scan_failed; never crash the process
    }
    return doc;
  } finally {
    await fs.promises.unlink(file.path).catch(() => undefined);
  }
}

export function uploadsRouter(deps: { requireAuth: any; verified: any[]; scanner?: BouncerClient }) {
  const r = Router(); const { requireAuth, verified } = deps;
  r.post("/assignment", requireAuth, ...verified, requireRole("student", "admin"), makeUploader("assignment").single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "assignment", deps.scanner), 201)));
  r.post("/content", requireAuth, ...verified, requireRole("teacher", "admin"), makeUploader("content").single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "content", deps.scanner), 201)));
  r.post("/avatar", requireAuth, ...verified, makeUploader("avatar").single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "avatar", deps.scanner), 201)));
  r.post("/cover", requireAuth, ...verified, makeUploader("cover").single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "cover", deps.scanner), 201)));

  const loadAuthorized = async (req: any) => {
    const doc: any = await Upload.findById(p(req).id); if (!doc) throw notFound("Upload not found");
    if (doc.ownerId === req.user.id || req.user.role === "admin") return doc;
    // Avatars and covers are public identity images — their IDs are already
    // exposed by the public teachers list, so any signed-in user may fetch
    // them. The clean/disabled scan gate still applies on download.
    if (doc.purpose === "avatar" || doc.purpose === "cover") return doc;
    if (doc.purpose === "assignment" && doc.relatedId) {
      // Exam-attempt attachments (e.g. written-test PDFs): the exam owner may review them.
      const attempt: any = await ExamAttempt.findById(doc.relatedId).lean();
      if (attempt) {
        const exam: any = await Exam.findById(attempt.examId).lean();
        if (exam?.ownerId === req.user.id) return doc;
      }
    }
    throw forbidden();
  };
  r.get("/:id", requireAuth, asyncHandler(async (req, res) => {
    const doc: any = await loadAuthorized(req);
    const o = doc.toObject();
    delete o.storageKey; // internal storage location is never exposed via the API
    delete o.checksum;
    ok(res, o);
  }));
  r.get("/:id/download", requireAuth, asyncHandler(async (req, res) => {
    const doc: any = await loadAuthorized(req);
    if (!isDownloadable(doc.scanStatus)) throw forbidden(`File not available: scan status is ${doc.scanStatus}`);
    const bytes = await storage.get(doc.storageKey); // private storage only; no public URLs
    res.setHeader("Content-Type", doc.detectedMime);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    res.send(bytes);
  }));
  return r;
}
