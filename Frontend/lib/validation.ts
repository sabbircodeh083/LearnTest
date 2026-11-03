/** Shared form-validation helpers. Every message names the field and the
 *  exact rule, so a wrong input always produces a proper, specific message. */

export const EMAIL_RE = /^\S+@\S+\.\S+$/;

export const requiredMsg = (label: string) => `${label} is required.`;

export function checkRequired(label: string, value: string): string {
  return value.trim() ? "" : requiredMsg(label);
}

export function checkEmail(value: string): string {
  const v = value.trim();
  if (!v) return "Email is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address (e.g. you@example.com).";
  return "";
}

export function checkMinLength(label: string, value: string, min: number): string {
  return value.trim().length >= min ? "" : `${label} must be at least ${min} characters.`;
}

export function checkMaxLength(label: string, value: string, max: number): string {
  return value.length <= max ? "" : `${label} must be ${max} characters or less.`;
}

/** Empty text in a numeric input becomes NaN here (not 0), so callers can
 *  distinguish "not entered" from a real 0. */
export function numOrNaN(value: string): number {
  return value.trim() === "" ? NaN : Number(value);
}

export function checkPrice(value: string, max = 1_000_000): string {
  const n = numOrNaN(value);
  if (Number.isNaN(n)) return "Price is required — enter an amount above 0.";
  if (!Number.isFinite(n) || n <= 0) return "Price must be above 0.";
  if (n > max) return `Price must be ${max.toLocaleString()} or less.`;
  return "";
}

export function checkTags(tags: string[], maxCount = 20, maxLen = 40): string {
  if (tags.length > maxCount) return `You can add at most ${maxCount} tags.`;
  const tooLong = tags.find((t) => t.length > maxLen);
  if (tooLong) return `Tag "${tooLong.slice(0, 20)}…" is too long — each tag must be ${maxLen} characters or less.`;
  return "";
}

/** Returns an error message, or "" when the date is a valid future time. */
export function checkFutureDate(label: string, value: string): string {
  if (!value.trim()) return `${label} is required.`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return `${label} must be a valid date and time.`;
  if (d.getTime() <= Date.now()) return `${label} must be in the future.`;
  return "";
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}
