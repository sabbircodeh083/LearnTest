import { describe, it, expect } from "vitest";
import { Report } from "../src/models/index.js";

describe("Report model (one report per user per item)", () => {
  it("requires reporterId, targetType, targetId, and reason", async () => {
    const err = (await new Report({}).validate().catch((e: unknown) => e)) as any;
    expect(err.errors.reporterId).toBeDefined();
    expect(err.errors.targetType).toBeDefined();
    expect(err.errors.targetId).toBeDefined();
    expect(err.errors.reason).toBeDefined();
  });

  it("enforces one report per reporter/target", () => {
    const idx = Report.schema
      .indexes()
      .find(([spec]) => spec.reporterId === 1 && spec.targetType === 1 && spec.targetId === 1);
    expect(idx?.[1]).toMatchObject({ unique: true });
  });
});
