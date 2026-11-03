import { createHash, createHmac } from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { env } from "../config/env.js";

/**
 * Private object storage. UPLOAD_STORAGE=s3 targets Cloudflare R2 (S3-compatible,
 * SigV4, path-style) — bucket must be PRIVATE (no public access / r2.dev disabled).
 * Keys always start with quarantine/ or files/; nothing here creates public URLs.
 * Local mode mirrors the same key layout under UPLOAD_DIR for development only.
 */
export const quarantineKey = (k: string) => `quarantine/${k}`;
export const approvedKey = (k: string) => k.replace(/^quarantine\//, "files/");

const useS3 = () => env.UPLOAD_STORAGE === "s3" && Boolean(env.OBJECT_STORAGE_ENDPOINT && env.OBJECT_STORAGE_BUCKET && env.OBJECT_STORAGE_ACCESS_KEY_ID && env.OBJECT_STORAGE_SECRET_ACCESS_KEY);
const localPath = (key: string) => { const root = path.resolve(env.UPLOAD_DIR); const p = path.join(root, key); if (!p.startsWith(root)) throw new Error("Invalid storage key"); return p; };

function sign(method: string, url: URL, body: Buffer, contentType: string) {
  const region = env.OBJECT_STORAGE_REGION || "auto";
  const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, "content-type": contentType };
  const names = Object.keys(headers).sort(); const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const canonical = [method, url.pathname, url.search.slice(1), canonicalHeaders, names.join(";"), payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const k = (key: string | Buffer, msg: string) => createHmac("sha256", key).update(msg).digest();
  const kDate = k(`AWS4${env.OBJECT_STORAGE_SECRET_ACCESS_KEY}`, date);
  const kRegion = k(kDate, region);
  const kService = k(kRegion, "s3");
  const signingKey = k(kService, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${env.OBJECT_STORAGE_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` };
}
function s3Url(key: string) { return new URL(`${env.OBJECT_STORAGE_ENDPOINT.replace(/\/$/, "")}/${env.OBJECT_STORAGE_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`); }
async function s3(method: string, key: string, body: Buffer<ArrayBufferLike> = Buffer.alloc(0), contentType = "application/octet-stream", extra: Record<string, string> = {}) {
  const url = s3Url(key);
  const res = await fetch(url, { method, body: method === "GET" || method === "DELETE" || method === "HEAD" ? undefined : body, headers: { ...sign(method, url, body, contentType), ...extra } });
  if (!res.ok && res.status !== 204) throw new Error(`Object storage ${method} failed (${res.status})`); // never log keys/credentials beyond status
  return res;
}

export const storage = {
  isRemote: useS3,
  async put(key: string, buffer: Buffer, contentType: string) {
    if (useS3()) { await s3("PUT", key, buffer, contentType); return; }
    const p = localPath(key); await fs.promises.mkdir(path.dirname(p), { recursive: true }); await fs.promises.writeFile(p, buffer);
  },
  async get(key: string): Promise<Buffer> {
    if (useS3()) { const res = await s3("GET", key); return Buffer.from(await res.arrayBuffer()); }
    return fs.promises.readFile(localPath(key));
  },
  /**
   * Stream an object (optionally a byte range) without buffering it in memory.
   * Used by the video player: 206 partial responses let the browser seek and
   * buffer progressively instead of downloading the whole file first.
   */
  async createReadStream(key: string, opts: { start?: number; end?: number } = {}): Promise<Readable> {
    const hasRange = Number.isSafeInteger(opts.start) && Number.isSafeInteger(opts.end);
    if (useS3()) {
      const extra: Record<string, string> = hasRange ? { Range: `bytes=${opts.start}-${opts.end}` } : {};
      const res = await s3("GET", key, undefined, "application/octet-stream", extra);
      if (!res.body) throw new Error("Object storage returned an empty body");
      return Readable.fromWeb(res.body as any);
    }
    return fs.createReadStream(localPath(key), hasRange ? { start: opts.start, end: opts.end } : {});
  },
  async delete(key: string) {
    if (useS3()) { await s3("DELETE", key).catch(() => undefined); return; }
    await fs.promises.unlink(localPath(key)).catch(() => undefined);
  },
  /** Promote quarantined -> approved. Only call after a clean scan verdict. */
  async promote(key: string): Promise<string> {
    const dest = approvedKey(key);
    if (dest === key) return key;
    const buf = await this.get(key);
    await this.put(dest, Buffer.from(buf), "application/octet-stream"); await this.delete(key);
    return dest;
  },
};
