import { describe, it, expect } from "vitest";
import { isAutoGradable, selectedIndexes, gradeMcqExam } from "../src/services/auto-grade.js";

const single = {
  _id: "q1", type: "mcq",
  options: ["3", "4", "5"], correctOptions: [1], multiple: false, marks: 2,
};
const multi = {
  _id: "q2", type: "mcq",
  options: ["2", "3", "4", "5"], correctOptions: [0, 1, 3], multiple: true, marks: 3,
};

describe("MCQ auto-grading", () => {
  it("detects gradable exams (all well-formed MCQ)", () => {
    expect(isAutoGradable([single, multi])).toBe(true);
    expect(isAutoGradable([])).toBe(false);
    expect(isAutoGradable([{ ...single, type: "short" }])).toBe(false);
    expect(isAutoGradable([{ ...single, correctOptions: [] }])).toBe(false);
    expect(isAutoGradable([{ ...single, correctOptions: [9] }])).toBe(false);
    expect(isAutoGradable([{ ...single, correctOptions: [0, 1] }])).toBe(false); // single with 2 correct
    expect(isAutoGradable([{ ...single, options: ["only"] }])).toBe(false);
  });

  it("parses indexes, numeric strings, and option text", () => {
    expect(selectedIndexes(1, single.options as string[])).toEqual(new Set([1]));
    expect(selectedIndexes("1", single.options as string[])).toEqual(new Set([1]));
    expect(selectedIndexes("4", single.options as string[])).toEqual(new Set([1]));
    expect(selectedIndexes([0, "5"], (multi.options as string[]))).toEqual(new Set([0, 3]));
    expect(selectedIndexes("nope", single.options as string[])).toBeNull();
    expect(selectedIndexes(undefined, single.options as string[])).toBeNull();
    expect(selectedIndexes(9, single.options as string[])).toBeNull();
  });

  it("grades single + multiple correctly (exact set match)", () => {
    expect(gradeMcqExam([single, multi], { q1: 1, q2: [0, 1, 3] })).toMatchObject({ score: 5, total: 5, correctCount: 2 });
    // partial multi-select earns nothing
    expect(gradeMcqExam([single, multi], { q1: 1, q2: [0, 1] })).toMatchObject({ score: 2, correctCount: 1 });
    // extra wrong option fails the question
    expect(gradeMcqExam([single, multi], { q1: 1, q2: [0, 1, 2, 3] })).toMatchObject({ score: 2, correctCount: 1 });
    // missing answer fails the question
    expect(gradeMcqExam([single, multi], { q1: 0, q2: [0, 1, 3] })).toMatchObject({ score: 3, correctCount: 1 });
    // text answers accepted
    expect(gradeMcqExam([single], { q1: "4" })).toMatchObject({ score: 2, correctCount: 1 });
  });
});
