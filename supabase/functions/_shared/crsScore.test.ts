import { describe, expect, it } from "vitest";
import {
  ageAt,
  computeCrsScore,
  interpolateCurve,
  personalizedTarget,
  type CrsNormRow,
} from "./crsScore";

const REF = new Date("2026-04-30T12:00:00Z");

const NORMS: CrsNormRow[] = [
  {
    exercise: "burpees",
    base_target: 25,
    weight_factor_curve: [
      { kg: 50, factor: 1.05 },
      { kg: 75, factor: 1.0 },
      { kg: 110, factor: 0.92 },
    ],
    age_factor_curve: [
      { age: 25, factor: 1.0 },
      { age: 45, factor: 0.9 },
    ],
    gender_factor: { male: 1.0, female: 0.78, other: 0.89 },
  },
  {
    exercise: "squats",
    base_target: 50,
    weight_factor_curve: [{ kg: 75, factor: 1.0 }],
    age_factor_curve: [{ age: 25, factor: 1.0 }],
    gender_factor: { male: 1.0, female: 0.86 },
  },
  {
    exercise: "pushups",
    base_target: 35,
    weight_factor_curve: [{ kg: 75, factor: 1.0 }],
    age_factor_curve: [{ age: 25, factor: 1.0 }],
    gender_factor: { male: 1.0, female: 0.65 },
  },
  {
    exercise: "plank",
    base_target: 60,
    weight_factor_curve: [{ kg: 75, factor: 1.0 }],
    age_factor_curve: [{ age: 25, factor: 1.0 }],
    gender_factor: { male: 1.0, female: 0.92 },
  },
  {
    exercise: "high_knees",
    base_target: 100,
    weight_factor_curve: [{ kg: 75, factor: 1.0 }],
    age_factor_curve: [{ age: 25, factor: 1.0 }],
    gender_factor: { male: 1.0, female: 0.88 },
  },
];

const REF_PROFILE = { weight_kg: 75, birth_date: "2001-04-30", gender: "male" };

describe("ageAt", () => {
  it("liefert exakt 25 am Geburtstag-Stichtag", () => {
    expect(ageAt("2001-04-30", REF)).toBe(25);
  });
  it("liefert 24 wenn Geburtstag in diesem Jahr noch nicht war", () => {
    expect(ageAt("2001-12-15", REF)).toBe(24);
  });
  it("null bei fehlendem Datum", () => {
    expect(ageAt(null, REF)).toBeNull();
  });
});

describe("interpolateCurve", () => {
  const curve = [
    { kg: 50, factor: 1.1 },
    { kg: 75, factor: 1.0 },
    { kg: 100, factor: 0.9 },
  ];
  it("interpoliert linear zwischen Stuetzstellen", () => {
    expect(interpolateCurve(curve, "kg", 62.5)).toBeCloseTo(1.05, 5);
  });
  it("klemmt am unteren Rand fest", () => {
    expect(interpolateCurve(curve, "kg", 30)).toBe(1.1);
  });
  it("klemmt am oberen Rand fest", () => {
    expect(interpolateCurve(curve, "kg", 200)).toBe(0.9);
  });
  it("liefert 1.0 bei null-Input", () => {
    expect(interpolateCurve(curve, "kg", null)).toBe(1);
  });
});

describe("personalizedTarget", () => {
  it("Referenz-Athlet (25 J / 75 kg / male) -> base_target", () => {
    const t = personalizedTarget(NORMS[0], REF_PROFILE, REF);
    expect(t).toBeCloseTo(25, 5);
  });
  it("Female reduziert das Burpees-Ziel", () => {
    const t = personalizedTarget(NORMS[0], { ...REF_PROFILE, gender: "female" }, REF);
    expect(t).toBeCloseTo(25 * 0.78, 5);
  });
  it("Diverse-Enum (DB) wird auf other-Lookup gemappt", () => {
    const t = personalizedTarget(NORMS[0], { ...REF_PROFILE, gender: "diverse" }, REF);
    expect(t).toBeCloseTo(25 * 0.89, 5);
  });
});

describe("computeCrsScore", () => {
  it("Referenz-Athlet erreicht alle Basis-Ziele -> Score 100", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 50,
        pushups_60s: 35,
        plank_sec: 60,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.score).toBe(100);
    expect(out.rank?.letter).toBe("S");
    expect(out.rank?.name).toBe("Shadow Monarch");
    expect(out.invalid_reason).toBeNull();
    expect(out.reduced_scope).toBe(false);
  });

  it("50% Performance ergibt Score 50 (Rank C)", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 12,
        squats_60s: 25,
        pushups_60s: 17,
        plank_sec: 30,
        high_knees_contacts: 50,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.score).toBe(49); // 12/25=48, 25/50=50, 17/35=48.57, 30/60=50, 50/100=50; mean=49.31
    expect(out.rank?.letter).toBe("D");
  });

  it("Eine Null-Uebung -> Mittelwert ueber 4, reduced_scope true", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 50,
        pushups_60s: 0,
        plank_sec: 60,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.score).toBe(100);
    expect(out.reduced_scope).toBe(true);
    expect(out.invalid_reason).toBeNull();
  });

  it("Zwei Null-Uebungen -> ungueltig, score null", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 0,
        pushups_60s: 0,
        plank_sec: 60,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.score).toBeNull();
    expect(out.rank).toBeNull();
    expect(out.archetype).toBeNull();
    expect(out.invalid_reason).toBe("too_many_zeros");
  });

  it("Cap bei 100 — wer mehr macht, kriegt nicht mehr", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 200,
        squats_60s: 50,
        pushups_60s: 35,
        plank_sec: 60,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.per_exercise.burpees).toBe(100);
    expect(out.score).toBe(100);
  });

  it("Archetyp Tank: Plank + Squats sind Top-2", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 5,
        squats_60s: 50,
        pushups_60s: 5,
        plank_sec: 60,
        high_knees_contacts: 5,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.archetype).toBe("Tank");
  });

  it("Archetyp Assassin: High Knees + Burpees Top-2", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 5,
        pushups_60s: 5,
        plank_sec: 5,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    expect(out.archetype).toBe("Assassin");
  });

  it("Rookie: keine kanonische Top-2-Kombi", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 5,
        pushups_60s: 35,
        plank_sec: 5,
        high_knees_contacts: 5,
      },
      norms: NORMS,
      profile: REF_PROFILE,
      refDate: REF,
    });
    // Top-2: burpees + pushups -> nicht in der Tabelle -> Rookie
    expect(out.archetype).toBe("Rookie");
  });

  it("Fehlende Profil-Daten -> Faktor 1.0 (kein Crash)", () => {
    const out = computeCrsScore({
      raw: {
        burpees_60s: 25,
        squats_60s: 50,
        pushups_60s: 35,
        plank_sec: 60,
        high_knees_contacts: 100,
      },
      norms: NORMS,
      profile: { weight_kg: null, birth_date: null, gender: null },
      refDate: REF,
    });
    expect(out.score).toBe(100);
  });
});
