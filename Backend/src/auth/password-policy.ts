/**
 * Password policy (§19.1).
 *
 * Server-side source of truth. The Better Auth `hooks.before` in auth.ts calls
 * this for every endpoint that *sets* a password (sign-up, reset, change, set)
 * — never for sign-in, so existing accounts keep working even if their old
 * password would not pass today.
 *
 * Rules:
 *  - at least 12 characters (Unicode code points)
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one symbol (non-alphanumeric, not whitespace)
 *  - at most 72 UTF-8 bytes — a technical limit, because bcrypt silently
 *    truncates anything longer
 *
 * Digits, common-password lists, name/email checks and pattern rules are
 * intentionally not part of the criteria.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordClassSet {
  lower: boolean;
  upper: boolean;
  symbol: boolean;
}

export function passwordClasses(password: string): PasswordClassSet {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    // Spaces are allowed but do not count as a symbol.
    symbol: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, "utf8");
}

/** All policy violations, in display order. Empty means the password is valid. */
export function validatePassword(password: unknown): string[] {
  if (typeof password !== "string" || password.length === 0)
    return ["Password is required."];
  if (password.trim().length === 0) return ["Password cannot be only spaces."];

  const errors: string[] = [];
  const length = [...password].length;

  if (length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    errors.push(
      `Password must be ${PASSWORD_MAX_BYTES} bytes or fewer (about ${PASSWORD_MAX_BYTES} characters).`,
    );
  }

  const classes = passwordClasses(password);
  if (!classes.upper)
    errors.push("Password must include at least one uppercase letter.");
  if (!classes.lower)
    errors.push("Password must include at least one lowercase letter.");
  if (!classes.symbol)
    errors.push("Password must include at least one symbol.");
  return errors;
}
