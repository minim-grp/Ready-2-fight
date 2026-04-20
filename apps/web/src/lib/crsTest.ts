export const CRS_EXERCISE_KEYS = [
  "burpees",
  "squats",
  "pushups",
  "plank",
  "high_knees",
] as const;

export type CrsExerciseKey = (typeof CRS_EXERCISE_KEYS)[number];

export type CrsExerciseMeta = {
  key: CrsExerciseKey;
  label: string;
  unit: string;
  maxValue: number;
};

export const CRS_EXERCISES: readonly CrsExerciseMeta[] = [
  { key: "burpees", label: "Burpees", unit: "Wiederholungen in 60 s", maxValue: 100 },
  { key: "squats", label: "Air Squats", unit: "Wiederholungen in 60 s", maxValue: 200 },
  {
    key: "pushups",
    label: "Push-ups",
    unit: "saubere Wiederholungen in 60 s",
    maxValue: 200,
  },
  {
    key: "plank",
    label: "Plank Hold",
    unit: "Sekunden gehalten (max. 60)",
    maxValue: 600,
  },
  {
    key: "high_knees",
    label: "High Knees",
    unit: "Bodenkontakte in 60 s",
    maxValue: 400,
  },
];

export const CRS_EXERCISE_DURATION_S = 60;
export const CRS_WARMUP_ROUND_DURATION_S = 60;
export const CRS_COOLDOWN_DURATION_S = 120;

export function getCrsExercise(index: number): CrsExerciseMeta {
  const ex = CRS_EXERCISES[index];
  if (!ex) throw new Error(`crs_exercise_index_out_of_range_${index}`);
  return ex;
}

export function getCrsWarmupHint(round: number): string {
  return CRS_WARMUP_ROUNDS[round] ?? "";
}

export const CRS_WARMUP_ROUNDS: readonly string[] = [
  "Leichtes Einlaufen auf der Stelle",
  "Arm-Kreisen vorwaerts und rueckwaerts",
  "Hueftkreisen und dynamisches Dehnen",
];

export type CrsStep =
  | { kind: "disclaimer" }
  | { kind: "warmup"; round: 0 | 1 | 2 }
  | { kind: "exercise"; index: 0 | 1 | 2 | 3 | 4; phase: "countdown" | "input" }
  | { kind: "cooldown" }
  | { kind: "result" };

export function nextStep(step: CrsStep): CrsStep {
  switch (step.kind) {
    case "disclaimer":
      return { kind: "warmup", round: 0 };
    case "warmup":
      return step.round < 2
        ? { kind: "warmup", round: (step.round + 1) as 1 | 2 }
        : { kind: "exercise", index: 0, phase: "countdown" };
    case "exercise":
      if (step.phase === "countdown") {
        return { ...step, phase: "input" };
      }
      return step.index < 4
        ? {
            kind: "exercise",
            index: (step.index + 1) as 1 | 2 | 3 | 4,
            phase: "countdown",
          }
        : { kind: "cooldown" };
    case "cooldown":
      return { kind: "result" };
    case "result":
      return step;
  }
}
