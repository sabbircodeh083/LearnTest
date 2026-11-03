import { describe, it, expect } from "vitest";
import { parseRange } from "../src/common/range.js";

describe("HTTP Range parsing (video buffering/seek)", () => {
  it("no header means full body", () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange("", 1000)).toBeNull();
  });
  it("closed range is inclusive", () => {
    expect(parseRange("bytes=0-499", 1000)).toEqual({ start: 0, end: 499 });
    expect(parseRange("bytes=500-999", 1000)).toEqual({ start: 500, end: 999 });
  });
  it("open-ended and over-long ranges clamp to the last byte", () => {
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });
  it("suffix ranges return the tail", () => {
    expect(parseRange("bytes=-500", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });
  it("impossible or malformed ranges are unsatisfiable", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=200-100", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-", 1000)).toBe("unsatisfiable");
    expect(parseRange("items=0-1", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-1", 0)).toBe("unsatisfiable");
  });
});
