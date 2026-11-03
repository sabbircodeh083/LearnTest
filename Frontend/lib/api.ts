"use client";

const rawApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
// Never send session cookies over plaintext http to a remote API from an
// https page (local development on localhost is unaffected).
export const API_BASE =
  typeof window !== "undefined" && window.location.protocol === "https:" && rawApiBase.startsWith("http://") && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(rawApiBase)
    ? rawApiBase.replace(/^http:\/\//, "https://")
    : rawApiBase;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface Envelope<T> { success: boolean; data: T; error: { code: string; message: string } | null; requestId?: string }

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON (e.g. Better Auth errors) */ }
  if (!res.ok) {
    const b = body as Envelope<T> | { message?: string; code?: string } | null;
    const message =
      (b as Envelope<T>)?.error?.message || (b as { message?: string })?.message ||
      (res.status === 401 ? "Please sign in to continue." :
       res.status === 403 ? "You do not have access to this." :
       res.status === 409 ? "This action conflicts with the current state." :
       res.status === 503 ? "The service is temporarily unavailable. Please retry." :
       `Request failed (${res.status}).`);
    const code = (b as Envelope<T>)?.error?.code || (b as { code?: string })?.code || "REQUEST_FAILED";
    throw new ApiError(res.status, code, message);
  }
  if (body && typeof body === "object" && "success" in (body as Record<string, unknown>)) {
    return (body as Envelope<T>).data;
  }
  return body as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  return parse<T>(res);
}

export const apiGet = <T,>(path: string) => api<T>(path);
export const apiPost = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });
export const apiPatch = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) });
export const apiDelete = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: "DELETE", body: data === undefined ? undefined : JSON.stringify(data) });

export async function apiUpload<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form, credentials: "include" });
  return parse<T>(res);
}

/** Fetch an authorized private file as a blob object URL (for inline preview). Caller must revoke. */
export async function apiBlobUrl(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "DOWNLOAD_FAILED", "This file is not available.");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Download an authorized private file through the backend (never a public R2 URL). */
export async function apiDownload(path: string, filename: string): Promise<void> {  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "DOWNLOAD_FAILED", "This file is not available for download.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};
