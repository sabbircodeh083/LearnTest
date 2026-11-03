import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { env } from "../config/env.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request { requestId: string; user?: import("../auth/guards.js").AuthUser } } }

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.header("x-request-id")?.slice(0, 64) || randomUUID());
  res.setHeader("x-request-id", req.requestId);
  next();
};
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, error: null, requestId: res.req.requestId });

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req[source]);
    if (!r.success) return next(r.error);
    // query/params are read-only in Express 4 getters in some setups; assign parsed body only
    if (source === "body") req.body = r.data; else (req as any)[`validated_${source}`] = r.data;
    next();
  };
}
export const q = (req: Request) => (req as any).validated_query ?? req.query;
export const p = (req: Request) => (req as any).validated_params ?? req.params;

/** Human-readable Zod failure: names every offending field and its rule,
 *  e.g. "title: Too small…; price: Too big…". Shown directly to users, so a
 *  wrong input produces a proper message instead of a generic "Invalid input". */
export function formatZodError(err: ZodError): string {
  const issues = err.issues.slice(0, 5);
  const parts = issues.map((i) => {
    const field = i.path.length ? i.path.map(String).join(".") : "input";
    return `${field}: ${i.message}`;
  });
  const extra = err.issues.length > 5 ? `; and ${err.issues.length - 5} more error${err.issues.length - 5 === 1 ? "" : "s"}` : "";
  return `Please fix: ${parts.join("; ")}${extra}`;
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({ success: false, data: null, error: { code: "VALIDATION_ERROR", message: formatZodError(err), details: err.flatten() }, requestId: req.requestId });
  if ((err as any)?.code === "LIMIT_FILE_SIZE")
    // Limits come from .env (never literals) so this message stays correct
    // when the operator changes the values.
    return res.status(400).json({ success: false, data: null, error: { code: "UPLOAD_ERROR", message: `File too large for its type (PDF ≤${env.MAX_PDF_SIZE_MB} MB, ZIP ≤${env.MAX_ZIP_SIZE_MB} MB, video ≤${env.MAX_VIDEO_SIZE_MB} MB, image ≤${env.MAX_IMAGE_SIZE_MB} MB).` }, requestId: req.requestId });
  if ((err as any)?.code === "LIMIT_FILE_COUNT" || (err as any)?.code === "LIMIT_UNEXPECTED_FILE" || (err as any)?.name === "MulterError")
    return res.status(400).json({ success: false, data: null, error: { code: "UPLOAD_ERROR", message: (err as Error).message }, requestId: req.requestId });
  if (err instanceof AppError)
    return res.status(err.status).json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId: req.requestId });
  logger.error({ err: { message: (err as Error)?.message }, requestId: req.requestId }, "unhandled error");
  return res.status(500).json({ success: false, data: null, error: { code: "INTERNAL_ERROR", message: "Internal server error" }, requestId: req.requestId });
};
export const notFoundHandler = (req: Request, res: Response) =>
  res.status(404).json({ success: false, data: null, error: { code: "NOT_FOUND", message: "Route not found" }, requestId: req.requestId });
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
