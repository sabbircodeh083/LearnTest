/** URL safety helpers — user-controlled URLs must never become
 *  `javascript:`/`data:` hrefs or open-redirect vectors. */

/** Returns the URL only when it is http(s); otherwise null. */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** Same-site return path only. Backslashes are rejected because browsers
 *  treat `/\evil.com` as a protocol-relative URL (open redirect). */
export function safeReturnTo(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\s\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

/** Payment/OAuth navigations leave the app only to https endpoints. */
export function isSafeGatewayUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.includes("sslcommerz");
  } catch {
    return false;
  }
}

/** Extracts a YouTube video ID from common URL formats, or returns null.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID,
 * m.youtube.com/watch?v=ID, and a raw 11-character ID. */
export function extractYouTubeVideoId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  // Raw 11-character YouTube ID.
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      return u.searchParams.get("v") ?? null;
    }
    if (host === "youtu.be") {
      return u.pathname.replace(/^\//, "") || null;
    }
    if (host === "youtube.com" && u.pathname.startsWith("/embed/")) {
      return u.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}
