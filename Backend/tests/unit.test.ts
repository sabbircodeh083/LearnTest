import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";
import { assertSignupRole } from "../src/auth/auth.js";
import { evaluateValidation, canTransition } from "../src/modules/payments/payment-state.js";
import { mimeMatchesExt, PURPOSE_RULES } from "../src/modules/uploads.routes.js";
import { formatZodError } from "../src/common/middleware.js";
import { contentBody } from "../src/common/schemas.js";

const order = { tranId: "LT-1", amount: 500, currency: "BDT" };
const valid = { status: "VALID", tran_id: "LT-1", amount: "500.00", currency: "BDT", risk_level: "0", val_id: "v1" };

describe("bcrypt via Better Auth callbacks contract (§19.1)", () => {
  it("hashes (never plaintext) and verifies correct/incorrect passwords", async () => {
    const hash = await bcrypt.hash("correct horse", 12);
    expect(hash).not.toContain("correct horse");
    expect(hash.startsWith("$2")).toBe(true);
    await expect(bcrypt.compare("correct horse", hash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrong", hash)).resolves.toBe(false);
  });
});

describe("role-based signup (§19.2)", () => {
  it("allows student/teacher, leaves empty undefined (OAuth/no-role)", () => {
    expect(assertSignupRole("student")).toBe("student");
    expect(assertSignupRole("teacher")).toBe("teacher");
    expect(assertSignupRole(undefined)).toBeUndefined();
  });
  it("rejects admin and any other role at public signup", () => {
    expect(() => assertSignupRole("admin")).toThrow();
    expect(() => assertSignupRole("superuser")).toThrow();
  });
});

describe("payment validation state machine (§7, §15)", () => {
  it("verified VALID with matching tran/amount/currency pays", () => {
    expect(evaluateValidation(order, valid).decision).toBe("paid");
    expect(evaluateValidation(order, { ...valid, status: "VALIDATED" }).decision).toBe("paid");
  });
  it("fake success without validation fields never pays", () => {
    expect(evaluateValidation(order, { status: "SUCCESS" }).decision).not.toBe("paid");
    expect(evaluateValidation(order, {}).decision).not.toBe("paid");
    expect(evaluateValidation(order, null as any).decision).toBe("rejected");
  });
  it("wrong amount / order / currency is rejected", () => {
    expect(evaluateValidation(order, { ...valid, amount: "1" }).decision).toBe("rejected");
    expect(evaluateValidation(order, { ...valid, tran_id: "OTHER" }).decision).toBe("rejected");
    expect(evaluateValidation(order, { ...valid, currency: "USD" }).decision).toBe("rejected");
  });
  it("risk_level=1 is held, FAILED/CANCELLED/EXPIRED map explicitly", () => {
    expect(evaluateValidation(order, { ...valid, risk_level: "1" }).decision).toBe("risk_hold");
    expect(evaluateValidation(order, { status: "FAILED" }).decision).toBe("failed");
    expect(evaluateValidation(order, { status: "CANCELLED" }).decision).toBe("cancelled");
    expect(evaluateValidation(order, { status: "EXPIRED" }).decision).toBe("expired");
    expect(evaluateValidation(order, { status: "UNATTEMPTED" }).decision).toBe("pending");
  });
  it("transitions are controlled and idempotent (paid is terminal)", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "paid")).toBe(true); // duplicate IPN = no-op
    expect(canTransition("paid", "failed")).toBe(false);
    expect(canTransition("failed", "paid")).toBe(false);
  });
});

describe("validation error messages", () => {
  it("names the offending field and rule instead of a generic message", () => {
    const r = contentBody.safeParse({ title: "", price: -5, currency: "EUR" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = formatZodError(r.error);
      expect(msg).toContain("title");
      expect(msg).toContain("price");
      expect(msg).toContain("currency");
      expect(msg).not.toBe("Invalid input");
    }
  });
});

describe("upload type rules (§9)", () => {
  it("magic-detected MIME must match extension; SVG/executables absent from allowlists", () => {
    expect(mimeMatchesExt("application/pdf", "a.pdf")).toBe(true);
    expect(mimeMatchesExt("application/pdf", "a.png")).toBe(false);
    expect(mimeMatchesExt("image/png", "evil.svg")).toBe(false);
    for (const rules of Object.values(PURPOSE_RULES)) {
      expect(rules.exts).not.toContain(".svg");
      expect(rules.exts).not.toContain(".exe");
      expect(rules.mimes).not.toContain("image/svg+xml");
    }
    expect(PURPOSE_RULES.assignment!.exts).toEqual([".pdf", ".zip"]);
  });
});
