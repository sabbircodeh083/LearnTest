/**
 * Mirror of Backend/src/auth/password-policy.ts for instant client feedback.
 * The server is authoritative; keep the rules in sync.
 *
 * Rules: 12+ characters, at least 1 uppercase, 1 lowercase and 1 symbol.
 * The 72-byte cap is bcrypt's technical limit, not a strength requirement.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordChecks {
  required: boolean;
  minLength: boolean;
  maxBytes: boolean;
  upper: boolean;
  lower: boolean;
  symbol: boolean;
  valid: boolean;
}

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export function passwordClasses(password: string): { lower: boolean; upper: boolean; symbol: boolean } {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function passwordChecks(password: string): PasswordChecks {
  const required = password.length > 0;
  const blank = password.trim().length === 0;
  const length = [...password].length;
  const minLength = required && !blank && length >= PASSWORD_MIN_LENGTH;
  const maxBytes = required && passwordByteLength(password) <= PASSWORD_MAX_BYTES;
  const classes = passwordClasses(password);
  const upper = required && classes.upper;
  const lower = required && classes.lower;
  const symbol = required && classes.symbol;
  return {
    required,
    minLength,
    maxBytes,
    upper,
    lower,
    symbol,
    valid: required && !blank && minLength && maxBytes && upper && lower && symbol,
  };
}

/** All violations, in the same order as the backend. */
export function passwordErrors(password: string): string[] {
  if (!password) return ["Password is required."];
  if (password.trim().length === 0) return ["Password cannot be only spaces."];

  const errors: string[] = [];
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    errors.push(`Password must be ${PASSWORD_MAX_BYTES} bytes or fewer (about ${PASSWORD_MAX_BYTES} characters).`);
  }
  const classes = passwordClasses(password);
  if (!classes.upper) errors.push("Password must include at least one uppercase letter.");
  if (!classes.lower) errors.push("Password must include at least one lowercase letter.");
  if (!classes.symbol) errors.push("Password must include at least one symbol.");
  return errors;
}

/** First violation, or "" when the password is acceptable. */
export function checkPassword(password: string): string {
  return passwordErrors(password)[0] ?? "";
}
