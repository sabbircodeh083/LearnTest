import { describe, it, expect } from "vitest";
import { Assignment } from "../src/models/index.js";

describe("Assignment model (submission attempts)", () => {
  it("defaults maxAttempts to 1", () => {
    expect(new Assignment({ ownerId: "t1", title: "Project" }).get("maxAttempts")).toBe(1);
  });

  it("rejects maxAttempts outside 1–20", async () => {
    const low = (await new Assignment({ ownerId: "t1", title: "P", maxAttempts: 0 })
      .validate()
      .catch((e: unknown) => e)) as any;
    expect(low.errors.maxAttempts).toBeDefined();
    const high = (await new Assignment({ ownerId: "t1", title: "P", maxAttempts: 21 })
      .validate()
      .catch((e: unknown) => e)) as any;
    expect(high.errors.maxAttempts).toBeDefined();
  });
});
