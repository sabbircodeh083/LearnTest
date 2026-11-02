// Instant grading for MCQ-only exams. Pure functions — no DB access, unit-tested.
//
// Student answer format per question id:
//   single-answer MCQ → option index (number) or option text (string)
//   multiple-answer MCQ → array of option indexes and/or option texts
// Anything unrecognized counts as incorrect (never throws).

export interface GradableQuestion {
  _id: unknown;
  type: string;
  options?: unknown;
  correctOptions?: unknown;
  multiple?: unknown;
  marks?: unknown;
}

const asOptions = (q: GradableQuestion): string[] | null =>
  Array.isArray(q.options) && q.options.length >= 2 && q.options.every((o) => typeof o === "string")
    ? (q.options as string[])
    : null;

const asCorrect = (q: GradableQuestion): number[] | null =>
  Array.isArray(q.correctOptions) &&
  q.correctOptions.length > 0 &&
  q.correctOptions.every((n) => Number.isInteger(n) && (n as number) >= 0)
    ? (q.correctOptions as number[])
    : null;

/** This exam can be graded instantly: every question is a well-formed MCQ. */
export function isAutoGradable(questions: GradableQuestion[]): boolean {
  if (!questions.length) return false;
  return questions.every((q) => {
    if (q.type !== "mcq") return false;
    const options = asOptions(q);
    const correct = asCorrect(q);
    if (!options || !correct) return false;
    if (!correct.every((i) => i < options.length)) return false;
    if (new Set(correct).size !== correct.length) return false;
    if (!q.multiple && correct.length !== 1) return false;
    return true;
  });
}

/** Selected option indexes from one raw student answer (null = unparseable). */
export function selectedIndexes(raw: unknown, options: string[]): Set<number> | null {
  const list = Array.isArray(raw) ? raw : [raw];
  const set = new Set<number>();
  for (const el of list) {
    if (typeof el === "number" && Number.isInteger(el) && el >= 0 && el < options.length) {
      set.add(el);
      continue;
    }
    if (typeof el === "string" && el.trim() !== "") {
      const n = Number(el);
      if (el.trim() !== "" && Number.isInteger(n) && n >= 0 && n < options.length) {
        set.add(n);
        continue;
      }
      const idx = options.findIndex((o) => o.trim().toLowerCase() === el.trim().toLowerCase());
      if (idx < 0) return null;
      set.add(idx);
      continue;
    }
    return null;
  }
  return set;
}

export interface GradeResult {
  score: number;
  total: number;
  correctCount: number;
  feedback: string;
}

/** Grade an all-MCQ exam. Call only after isAutoGradable() is true. */
export function gradeMcqExam(
  questions: GradableQuestion[],
  answers: Record<string, unknown>,
): GradeResult {
  let score = 0;
  let total = 0;
  let correctCount = 0;
  for (const q of questions) {
    const options = asOptions(q)!;
    const correct = asCorrect(q)!;
    const marks = typeof q.marks === "number" && q.marks >= 0 ? q.marks : 1;
    total += marks;
    const selected = selectedIndexes(answers[String(q._id)], options);
    const ok =
      selected !== null &&
      selected.size === correct.length &&
      correct.every((i) => selected.has(i));
    if (ok) {
      score += marks;
      correctCount += 1;
    }
  }
  return {
    score,
    total,
    correctCount,
    feedback: `Auto-graded: ${correctCount}/${questions.length} correct (${score}/${total} marks).`,
  };
}
