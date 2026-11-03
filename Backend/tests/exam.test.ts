import { describe, it, expect } from "vitest";
import { Exam } from "../src/models/index.js";

describe("Exam model (attempt limits)", () => {
  it("defaults maxAttempts to 1", () => {
    expect(new Exam({ ownerId: "t1", title: "Project", durationMinutes: 30 }).get("maxAttempts")).toBe(1);
  });

  it("rejects maxAttempts outside 1-20", async () => {
    const low = (await new Exam({ ownerId: "t1", title: "P", durationMinutes: 30, maxAttempts: 0 })
      .validate()
      .catch((e: unknown) => e)) as any;
    expect(low.errors.maxAttempts).toBeDefined();
    const high = (await new Exam({ ownerId: "t1", title: "P", durationMinutes: 30, maxAttempts: 21 })
      .validate()
      .catch((e: unknown) => e)) as any;
    expect(high.errors.maxAttempts).toBeDefined();
  });

  it("defaults kind to quiz and accepts project", () => {
    expect(new Exam({ ownerId: "t1", title: "Q", durationMinutes: 30 }).get("kind")).toBe("quiz");
    expect(new Exam({ ownerId: "t1", title: "P", durationMinutes: 30, kind: "project" }).get("kind")).toBe("project");
  });
});
