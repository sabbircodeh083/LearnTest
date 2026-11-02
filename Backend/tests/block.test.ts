import { describe, it, expect } from "vitest";
import { Block } from "../src/models/index.js";

describe("Block model (blocked teachers)", () => {
  it("requires userId and teacherId", async () => {
    const err = (await new Block({}).validate().catch((e: unknown) => e)) as any;
    expect(err.errors.userId).toBeDefined();
    expect(err.errors.teacherId).toBeDefined();
  });

  it("accepts a user/teacher pair", async () => {
    await new Block({ userId: "u1", teacherId: "t1" }).validate();
  });

  it("enforces one block per user/teacher", () => {
    const idx = Block.schema
      .indexes()
      .find(([spec]) => spec.userId === 1 && spec.teacherId === 1);
    expect(idx?.[1]).toMatchObject({ unique: true });
  });
});
