// HTTP Range parsing for private media streaming. Browsers buffer <video> by
// issuing byte-range requests, so a player only works correctly when the
// server answers 206 with a Content-Range instead of dumping the whole file.
export type ByteRange = { start: number; end: number };

/**
 * Parse a single-range `Range` header against a known resource size.
 * - `null`            → no (or unusable) Range header: send the full body (200)
 * - "unsatisfiable"   → respond 416 (and never fall back to a full send)
 */
export function parseRange(header: string | undefined | null, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "unsatisfiable";
  if (!Number.isSafeInteger(size) || size <= 0) return "unsatisfiable";
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return "unsatisfiable";
  if (rawStart === "") {
    // Suffix range: the last N bytes (bytes=-500).
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "unsatisfiable";
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isSafeInteger(start) || start >= size) return "unsatisfiable";
  let end = rawEnd === "" ? size - 1 : Number(rawEnd);
  if (!Number.isSafeInteger(end)) return "unsatisfiable";
  if (end >= size) end = size - 1;
  if (end < start) return "unsatisfiable";
  return { start, end };
}
