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
import { Assignment, Exam, ExamAttempt, Upload } from "../models/index.js";
import { storage, quarantineKey, approvedKey } from "../services/storage.js";
import { BouncerClient, scanUploadDoc } from "../services/malware-scan.js";

export const PURPOSE_RULES: Record<string, { exts: string[]; mimes: string[] }> = {
  assignment: { exts: [".pdf", ".zip"], mimes: ["application/pdf", "application/zip"] },
  content: { exts: [".pdf", ".mp4", ".png", ".jpg", ".jpeg", ".webp"], mimes: ["application/pdf", "video/mp4", "image/png", "image/jpeg", "image/webp"] },
  avatar: { exts: [".png", ".jpg", ".jpeg", ".webp"], mimes: ["image/png", "image/jpeg", "image/webp"] },
  cover: { exts: [".png", ".jpg", ".jpeg", ".webp"], mimes: ["image/png", "image/jpeg", "image/webp"] },
};
// Magic-byte check: detected type must match declared MIME and extension family. SVG is never allowed (script risk).
export function mimeMatchesExt(mime: string, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string[]> = { ".pdf": ["application/pdf"], ".png": ["image/png"], ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".webp": ["image/webp"], ".mp4": ["video/mp4"], ".zip": ["application/zip", "application/x-zip-compressed"] };
  return (map[ext] ?? []).includes(mime);
}
/** Downloadable only after a clean scan, or when scanning is explicitly disabled (never pending/failed/infected). */
export const isDownloadable = (scanStatus: string) => scanStatus === "clean" || scanStatus === "disabled";

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(path.join(uploadDir, "tmp"), { recursive: true });
const multerUpload = multer({
  dest: path.join(uploadDir, "tmp"),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: env.MAX_UPLOAD_FILES, fields: 10, fieldSize: 100 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(exe|sh|bat|js|mjs|html?|svg|php)$/i.test(file.originalname) || file.originalname.includes("..")) return cb(new Error("Disallowed file name/type"));
    cb(null, true);
  },
});

async function handleUpload(req: any, purpose: string, scanner?: BouncerClient) {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw badRequest("File required");
  try {
    const fields = z.object({ relatedId: z.string().max(100).optional() }).parse(req.body ?? {});
    const rules = PURPOSE_RULES[purpose]!;
    const ext = path.extname(file.originalname).toLowerCase();
    if (!rules.exts.includes(ext)) throw badRequest(`Extension ${ext} not allowed for ${purpose}`);
    const detected = await fileTypeFromFile(file.path).catch(() => undefined);
    if (!detected || !rules.mimes.includes(detected.mime) || !mimeMatchesExt(detected.mime, file.originalname)) throw badRequest("File content does not match declared type");
    if (detected.mime !== file.mimetype && !(file.mimetype === "application/octet-stream")) throw badRequest("Declared MIME does not match file content");
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
  r.post("/assignment", requireAuth, ...verified, requireRole("student", "admin"), multerUpload.single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "assignment", deps.scanner), 201)));
  r.post("/content", requireAuth, ...verified, requireRole("teacher", "admin"), multerUpload.single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "content", deps.scanner), 201)));
  r.post("/avatar", requireAuth, ...verified, multerUpload.single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "avatar", deps.scanner), 201)));
  r.post("/cover", requireAuth, ...verified, multerUpload.single("file"), asyncHandler(async (req, res) => ok(res, await handleUpload(req, "cover", deps.scanner), 201)));

  const loadAuthorized = async (req: any) => {
    const doc: any = await Upload.findById(p(req).id); if (!doc) throw notFound("Upload not found");
    if (doc.ownerId === req.user.id || req.user.role === "admin") return doc;
    // Avatars and covers are public identity images — their IDs are already
    // exposed by the public teachers list, so any signed-in user may fetch
    // them. The clean/disabled scan gate still applies on download.
    if (doc.purpose === "avatar" || doc.purpose === "cover") return doc;
    if (doc.purpose === "assignment" && doc.relatedId) {
      const a: any = await Assignment.findById(doc.relatedId).lean();
      if (a?.ownerId === req.user.id) return doc;
      // Exam-attempt attachments (e.g. written-test PDFs): the exam owner may review them.
      const attempt: any = await ExamAttempt.findById(doc.relatedId).lean();
      if (attempt) {
        const exam: any = await Exam.findById(attempt.examId).lean();
        if (exam?.ownerId === req.user.id) return doc;
      }
    }
    throw forbidden();
  };
  r.get("/:id", requireAuth, asyncHandler(async (req, res) => ok(res, await loadAuthorized(req))));
  // Authorized review workflow: re-scan a failed/pending file (owner or admin). Still fail-closed until clean.
  r.post("/:id/rescan", requireAuth, asyncHandler(async (req, res) => {
    const doc: any = await loadAuthorized(req);
    if (!env.MALWARE_SCAN_ENABLED) throw badRequest("Malware scanning is disabled");
    if (!["scan_failed", "pending_scan"].includes(doc.scanStatus)) throw badRequest(`Cannot rescan file in state ${doc.scanStatus}`);
    const bytes = await storage.get(doc.storageKey);
    const status = await scanUploadDoc(doc, bytes, deps.scanner ?? new BouncerClient());
    if (status === "clean") { doc.storageKey = await storage.promote(doc.storageKey); await doc.save(); }
    return ok(res, doc);
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
