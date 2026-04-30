import type { CreateExerciseInput, PlanExercise } from "../../hooks/queries/usePlans";

export type ExerciseFormState = {
  name: string;
  sets: string;
  reps: string;
  weight_kg: string;
  duration_sec: string;
  rest_sec: string;
  notes: string;
};

export const EMPTY_EXERCISE_FORM: ExerciseFormState = {
  name: "",
  sets: "",
  reps: "",
  weight_kg: "",
  duration_sec: "",
  rest_sec: "",
  notes: "",
};

function parseInteger(
  s: string,
  label: string,
  min: number,
  max: number,
): number | string {
  if (s.trim() === "") return "__empty__";
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    return `${label} muss eine ganze Zahl sein.`;
  if (n < min || n > max) return `${label} muss zwischen ${min} und ${max} liegen.`;
  return n;
}

function parseFloatVal(
  s: string,
  label: string,
  min: number,
  max: number,
): number | string {
  if (s.trim() === "") return "__empty__";
  const n = Number(s);
  if (!Number.isFinite(n)) return `${label} muss eine Zahl sein.`;
  if (n < min || n > max) return `${label} muss zwischen ${min} und ${max} liegen.`;
  return n;
}

export function validateExerciseForm(s: ExerciseFormState): string | null {
  const name = s.name.trim();
  if (!name) return "Name ist Pflicht.";
  if (name.length > 120) return "Name darf maximal 120 Zeichen haben.";
  if (s.notes.length > 2000) return "Notizen duerfen maximal 2000 Zeichen haben.";

  const sets = parseInteger(s.sets, "Saetze", 1, 99);
  if (typeof sets === "string" && sets !== "__empty__") return sets;
  const reps = parseInteger(s.reps, "Wiederholungen", 1, 999);
  if (typeof reps === "string" && reps !== "__empty__") return reps;
  const weight = parseFloatVal(s.weight_kg, "Gewicht (kg)", 0, 500);
  if (typeof weight === "string" && weight !== "__empty__") return weight;
  const duration = parseInteger(s.duration_sec, "Dauer (Sek.)", 0, 36000);
  if (typeof duration === "string" && duration !== "__empty__") return duration;
  const rest = parseInteger(s.rest_sec, "Pause (Sek.)", 0, 3600);
  if (typeof rest === "string" && rest !== "__empty__") return rest;

  return null;
}

export function exerciseFormToInput(
  s: ExerciseFormState,
  session_id: string,
  position: number,
): CreateExerciseInput {
  const setsParsed = parseInteger(s.sets, "Saetze", 1, 99);
  const repsParsed = parseInteger(s.reps, "Wiederholungen", 1, 999);
  const weightParsed = parseFloatVal(s.weight_kg, "Gewicht (kg)", 0, 500);
  const durationParsed = parseInteger(s.duration_sec, "Dauer (Sek.)", 0, 36000);
  const restParsed = parseInteger(s.rest_sec, "Pause (Sek.)", 0, 3600);

  return {
    session_id,
    name: s.name.trim(),
    sets: typeof setsParsed === "number" ? setsParsed : null,
    reps: typeof repsParsed === "number" ? repsParsed : null,
    weight_kg: typeof weightParsed === "number" ? weightParsed : null,
    duration_sec: typeof durationParsed === "number" ? durationParsed : null,
    rest_sec: typeof restParsed === "number" ? restParsed : null,
    notes: s.notes.trim() ? s.notes.trim() : null,
    position,
  };
}

export function nextExercisePosition(exercises: ReadonlyArray<PlanExercise>): number {
  if (exercises.length === 0) return 0;
  return Math.max(...exercises.map((e) => e.position)) + 1;
}

export function neighborForExerciseSwap(
  exercises: ReadonlyArray<PlanExercise>,
  current: PlanExercise,
  direction: "up" | "down",
): PlanExercise | null {
  const idx = exercises.findIndex((e) => e.id === current.id);
  if (idx < 0) return null;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= exercises.length) return null;
  return exercises[target] ?? null;
}

// Kompakte UI-Zusammenfassung der Exercise-Felder fuer die Card.
export function summarizeExercise(e: PlanExercise): string {
  const parts: string[] = [];
  if (e.sets != null && e.reps != null) parts.push(`${e.sets}×${e.reps}`);
  else if (e.sets != null) parts.push(`${e.sets} Saetze`);
  else if (e.reps != null) parts.push(`${e.reps} Wdh.`);
  if (e.weight_kg != null) parts.push(`${e.weight_kg} kg`);
  if (e.duration_sec != null) parts.push(`${e.duration_sec} s`);
  if (e.rest_sec != null) parts.push(`Pause ${e.rest_sec} s`);
  return parts.join(" · ");
}
