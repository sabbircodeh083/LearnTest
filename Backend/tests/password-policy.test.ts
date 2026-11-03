import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  passwordClasses,
  validatePassword,
} from "../src/auth/password-policy.js";

const hasError = (errors: string[], needle: RegExp) => errors.some((e) => needle.test(e));

describe("password policy (§19.1)", () => {
  it("requires a password and rejects whitespace-only values", () => {
    expect(validatePassword("")).toEqual(["Password is required."]);
    expect(validatePassword(undefined)).toEqual(["Password is required."]);
    expect(validatePassword("            ")).toEqual(["Password cannot be only spaces."]);
  });

  it("enforces 12 characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(hasError(validatePassword("Abcdefghij!"), /at least 12/)).toBe(true); // 11
    expect(validatePassword("Abcdefghij!k")).toEqual([]); // 12
  });

  it("requires an uppercase letter", () => {
    expect(hasError(validatePassword("abcdefghij!k"), /uppercase/)).toBe(true);
    expect(validatePassword("Abcdefghij!k")).toEqual([]);
  });

  it("requires a lowercase letter", () => {
    expect(hasError(validatePassword("ABCDEFGHIJ!K"), /lowercase/)).toBe(true);
    expect(validatePassword("Abcdefghij!k")).toEqual([]);
  });

  it("requires a symbol", () => {
    expect(hasError(validatePassword("AbcdefghijkL"), /symbol/)).toBe(true);
    expect(passwordClasses("AbcdefghijkL").symbol).toBe(false);
    expect(validatePassword("Abcdefghij!k")).toEqual([]);
  });

  it("does not require a digit or reject common/passphrase-style values", () => {
    expect(passwordClasses("Abcdefghij!k").lower).toBe(true);
    expect(passwordClasses("Abcdefghij!k").upper).toBe(true);
    expect(validatePassword("Abcdefghij!k")).toEqual([]); // no digit
    expect(validatePassword("Password1234!")).toEqual([]); // 13 chars, digit allowed but not required
  });

  it("caps passwords at bcrypt's 72-byte limit", () => {
    expect(PASSWORD_MAX_BYTES).toBe(72);
    expect(passwordByteLength("😀")).toBe(4);
    const errors = validatePassword("Abcdefghij!😀".repeat(6)); // well over 72 bytes
    expect(hasError(errors, /72 bytes/)).toBe(true);
  });
});
