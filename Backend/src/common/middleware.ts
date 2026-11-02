import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { AppError } from "./errors.js";
import { logger } from "./logger.js";

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

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({ success: false, data: null, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() }, requestId: req.requestId });
  if ((err as any)?.code === "LIMIT_FILE_SIZE" || (err as any)?.name === "MulterError")
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
