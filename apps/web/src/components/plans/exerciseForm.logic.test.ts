import { describe, expect, it } from "vitest";
import {
  EMPTY_EXERCISE_FORM,
  exerciseFormToInput,
  neighborForExerciseSwap,
  nextExercisePosition,
  summarizeExercise,
  validateExerciseForm,
  type ExerciseFormState,
} from "./exerciseForm.logic";
import type { PlanExercise } from "../../hooks/queries/usePlans";

function form(overrides: Partial<ExerciseFormState> = {}): ExerciseFormState {
  return { ...EMPTY_EXERCISE_FORM, name: "Bankdruecken", ...overrides };
}

function ex(
  id: string,
  position: number,
  overrides: Partial<PlanExercise> = {},
): PlanExercise {
  return {
    id,
    session_id: "s1",
    name: id,
    sets: null,
    reps: null,
    weight_kg: null,
    duration_sec: null,
    rest_sec: null,
    notes: null,
    position,
    ...overrides,
  };
}

describe("validateExerciseForm", () => {
  it("akzeptiert minimal gueltige Form (nur Name)", () => {
    expect(validateExerciseForm(form())).toBeNull();
  });

  it("verlangt Name", () => {
    expect(validateExerciseForm(form({ name: "" }))).toMatch(/Name/);
    expect(validateExerciseForm(form({ name: "  " }))).toMatch(/Name/);
  });

  it("kappt Name bei 120, Notes bei 2000 Zeichen", () => {
    expect(validateExerciseForm(form({ name: "x".repeat(121) }))).toMatch(/120/);
    expect(validateExerciseForm(form({ notes: "x".repeat(2001) }))).toMatch(/2000/);
  });

  it("Saetze 1–99 Integer", () => {
    expect(validateExerciseForm(form({ sets: "0" }))).toMatch(/1 und 99/);
    expect(validateExerciseForm(form({ sets: "100" }))).toMatch(/1 und 99/);
    expect(validateExerciseForm(form({ sets: "1.5" }))).toMatch(/ganze Zahl/);
    expect(validateExerciseForm(form({ sets: "abc" }))).toMatch(/ganze Zahl/);
    expect(validateExerciseForm(form({ sets: "5" }))).toBeNull();
  });

  it("Wdh 1–999 Integer", () => {
    expect(validateExerciseForm(form({ reps: "0" }))).toMatch(/1 und 999/);
    expect(validateExerciseForm(form({ reps: "1000" }))).toMatch(/1 und 999/);
    expect(validateExerciseForm(form({ reps: "12" }))).toBeNull();
  });

  it("Gewicht 0–500 als Zahl (auch dezimal)", () => {
    expect(validateExerciseForm(form({ weight_kg: "-1" }))).toMatch(/0 und 500/);
    expect(validateExerciseForm(form({ weight_kg: "501" }))).toMatch(/0 und 500/);
    expect(validateExerciseForm(form({ weight_kg: "abc" }))).toMatch(/Zahl/);
    expect(validateExerciseForm(form({ weight_kg: "82.5" }))).toBeNull();
  });

  it("Dauer 0–36000 Integer, Pause 0–3600 Integer", () => {
    expect(validateExerciseForm(form({ duration_sec: "36001" }))).toMatch(/Dauer/);
    expect(validateExerciseForm(form({ rest_sec: "3601" }))).toMatch(/Pause/);
    expect(validateExerciseForm(form({ duration_sec: "60", rest_sec: "90" }))).toBeNull();
  });
});

describe("exerciseFormToInput", () => {
  it("konvertiert leere Strings zu null", () => {
    const input = exerciseFormToInput(form(), "sess-1", 0);
    expect(input).toEqual({
      session_id: "sess-1",
      name: "Bankdruecken",
      sets: null,
      reps: null,
      weight_kg: null,
      duration_sec: null,
      rest_sec: null,
      notes: null,
      position: 0,
    });
  });

  it("parst Zahlen + trimmt Strings", () => {
    const input = exerciseFormToInput(
      form({
        name: "  Squat  ",
        sets: "4",
        reps: "8",
        weight_kg: "82.5",
        duration_sec: "60",
        rest_sec: "90",
        notes: "  langsam  ",
      }),
      "sess-1",
      3,
    );
    expect(input.name).toBe("Squat");
    expect(input.sets).toBe(4);
    expect(input.reps).toBe(8);
    expect(input.weight_kg).toBe(82.5);
    expect(input.duration_sec).toBe(60);
    expect(input.rest_sec).toBe(90);
    expect(input.notes).toBe("langsam");
    expect(input.position).toBe(3);
  });
});

describe("nextExercisePosition", () => {
  it("liefert 0 bei leerer Liste, max+1 sonst", () => {
    expect(nextExercisePosition([])).toBe(0);
    expect(nextExercisePosition([ex("a", 0), ex("b", 3), ex("c", 1)])).toBe(4);
  });
});

describe("neighborForExerciseSwap", () => {
  const list = [ex("a", 0), ex("b", 1), ex("c", 2)];

  it("up am Anfang / down am Ende -> null", () => {
    expect(neighborForExerciseSwap(list, list[0]!, "up")).toBeNull();
    expect(neighborForExerciseSwap(list, list[2]!, "down")).toBeNull();
  });

  it("Mittlerer Eintrag swapt mit Nachbarn", () => {
    expect(neighborForExerciseSwap(list, list[1]!, "up")?.id).toBe("a");
    expect(neighborForExerciseSwap(list, list[1]!, "down")?.id).toBe("c");
  });

  it("Unbekannter Eintrag -> null", () => {
    expect(neighborForExerciseSwap(list, ex("z", 99), "up")).toBeNull();
  });
});

describe("summarizeExercise", () => {
  it("Saetze + Reps mit ×, Gewicht in kg, Dauer/Pause in s", () => {
    expect(
      summarizeExercise(ex("b", 0, { sets: 4, reps: 8, weight_kg: 80, rest_sec: 90 })),
    ).toBe("4×8 · 80 kg · Pause 90 s");
  });

  it("Nur Reps zeigt Wdh.-Suffix", () => {
    expect(summarizeExercise(ex("b", 0, { reps: 12 }))).toBe("12 Wdh.");
  });

  it("Leer wenn nichts gesetzt ist", () => {
    expect(summarizeExercise(ex("b", 0))).toBe("");
  });

  it("Dauer ohne Pause", () => {
    expect(summarizeExercise(ex("plank", 0, { duration_sec: 60 }))).toBe("60 s");
  });
});
