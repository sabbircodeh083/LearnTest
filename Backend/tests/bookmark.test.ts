import { describe, it, expect } from "vitest";
import { Bookmark, CONTENT_TYPES } from "../src/models/index.js";

describe("Bookmark model (saved content)", () => {
  it("requires userId, targetType, and targetId", async () => {
    const err = await new Bookmark({}).validate().catch((e: unknown) => e) as any;
    expect(err.errors.userId).toBeDefined();
    expect(err.errors.targetType).toBeDefined();
    expect(err.errors.targetId).toBeDefined();
  });

  it("accepts every content type", async () => {
    for (const targetType of CONTENT_TYPES) {
      await new Bookmark({ userId: "u1", targetType, targetId: "t1" }).validate();
    }
  });

  it("rejects unknown target types", async () => {
    const err = await new Bookmark({ userId: "u1", targetType: "nope", targetId: "t1" })
      .validate()
      .catch((e: unknown) => e) as any;
    expect(err.errors.targetType).toBeDefined();
  });

  it("enforces one bookmark per user/target", () => {
    const idx = Bookmark.schema
      .indexes()
      .find(([spec]) => spec.userId === 1 && spec.targetType === 1 && spec.targetId === 1);
    expect(idx?.[1]).toMatchObject({ unique: true });
  });
});
