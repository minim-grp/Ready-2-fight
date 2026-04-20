import { describe, expect, it } from "vitest";
import { CRS_EXERCISES, nextStep, type CrsStep } from "./crsTest";

describe("CRS state machine transitions", () => {
  it("disclaimer -> warmup round 0", () => {
    expect(nextStep({ kind: "disclaimer" })).toEqual({ kind: "warmup", round: 0 });
  });

  it("warmup 0 -> warmup 1 -> warmup 2 -> exercise 0 countdown", () => {
    let s: CrsStep = { kind: "warmup", round: 0 };
    s = nextStep(s);
    expect(s).toEqual({ kind: "warmup", round: 1 });
    s = nextStep(s);
    expect(s).toEqual({ kind: "warmup", round: 2 });
    s = nextStep(s);
    expect(s).toEqual({ kind: "exercise", index: 0, phase: "countdown" });
  });

  it("exercise countdown -> input -> next countdown", () => {
    const s1: CrsStep = { kind: "exercise", index: 0, phase: "countdown" };
    const s2 = nextStep(s1);
    expect(s2).toEqual({ kind: "exercise", index: 0, phase: "input" });
    const s3 = nextStep(s2);
    expect(s3).toEqual({ kind: "exercise", index: 1, phase: "countdown" });
  });

  it("exercise 4 input -> cooldown -> result", () => {
    let s: CrsStep = { kind: "exercise", index: 4, phase: "input" };
    s = nextStep(s);
    expect(s).toEqual({ kind: "cooldown" });
    s = nextStep(s);
    expect(s).toEqual({ kind: "result" });
  });

  it("result is terminal", () => {
    const s: CrsStep = { kind: "result" };
    expect(nextStep(s)).toBe(s);
  });
});

describe("CRS exercise catalog", () => {
  it("has exactly five exercises in PRD order", () => {
    expect(CRS_EXERCISES.map((e) => e.key)).toEqual([
      "burpees",
      "squats",
      "pushups",
      "plank",
      "high_knees",
    ]);
  });
});
