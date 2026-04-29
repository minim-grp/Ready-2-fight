// CRS-Score-Berechnung (PRD Anhang B). Pure Scorer ohne externe I/O —
// in Vitest unter supabase/functions/_shared/crsScore.test.ts getestet.
// Die Edge Function compute-crs-score wrapped diesen Code mit DB-IO.

export const CRS_EXERCISES = [
  "burpees",
  "squats",
  "pushups",
  "plank",
  "high_knees",
] as const;

export type CrsExerciseKey = (typeof CRS_EXERCISES)[number];

export type FactorPoint = { kg?: number; age?: number; factor: number };

export type CrsNormRow = {
  exercise: CrsExerciseKey;
  base_target: number;
  weight_factor_curve: FactorPoint[];
  age_factor_curve: FactorPoint[];
  gender_factor: Record<string, number>;
};

export type AthleteProfile = {
  // Werte duerfen fehlen — Default-Faktor 1.0 wird angewendet.
  weight_kg: number | null;
  birth_date: string | null; // YYYY-MM-DD
  gender: string | null;
};

export type CrsRawValues = {
  burpees_60s: number | null;
  squats_60s: number | null;
  pushups_60s: number | null;
  plank_sec: number | null;
  high_knees_contacts: number | null;
};

export type CrsRank = {
  letter: "S" | "A" | "B" | "C" | "D" | "E";
  name: string;
};

export type CrsArchetype = "Tank" | "Assassin" | "Guardian" | "Berserker" | "Rookie";

export type CrsScoreOutput = {
  score: number | null;
  rank: CrsRank | null;
  archetype: CrsArchetype | null;
  per_exercise: Record<CrsExerciseKey, number>;
  invalid_reason: "too_many_zeros" | null;
  reduced_scope: boolean;
  // Debug: berechnete Zielwerte pro Uebung
  targets: Record<CrsExerciseKey, number>;
};

const RAW_TO_KEY: Record<CrsExerciseKey, keyof CrsRawValues> = {
  burpees: "burpees_60s",
  squats: "squats_60s",
  pushups: "pushups_60s",
  plank: "plank_sec",
  high_knees: "high_knees_contacts",
};

// gender_factor-JSONB-Seed nutzt 'other' als Key, das public.gender-Enum
// nutzt 'diverse'. Alias bis ein Followup-Migration die Keys angleicht.
const GENDER_ALIAS: Record<string, string> = { diverse: "other" };

export function ageAt(birthDate: string | null, refDate: Date): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = refDate.getFullYear() - b.getFullYear();
  const m = refDate.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < b.getDate())) age -= 1;
  return age;
}

export function interpolateCurve(
  curve: FactorPoint[],
  axis: "kg" | "age",
  x: number | null,
): number {
  if (x == null || curve.length === 0) return 1;
  const sorted = [...curve]
    .filter((p) => typeof p[axis] === "number")
    .sort((a, b) => (a[axis] as number) - (b[axis] as number));
  if (sorted.length === 0) return 1;
  if (x <= (sorted[0][axis] as number)) return sorted[0].factor;
  const last = sorted[sorted.length - 1];
  if (x >= (last[axis] as number)) return last.factor;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const ax = a[axis] as number;
    const bx = b[axis] as number;
    if (x <= bx) {
      const t = (x - ax) / (bx - ax);
      return a.factor + t * (b.factor - a.factor);
    }
  }
  return 1;
}

function genderFactor(gender: string | null, map: Record<string, number>): number {
  if (!gender) return 1.0;
  const key = GENDER_ALIAS[gender] ?? gender;
  return map[key] ?? 1.0;
}

export function personalizedTarget(
  norm: CrsNormRow,
  profile: AthleteProfile,
  refDate: Date,
): number {
  const w = interpolateCurve(norm.weight_factor_curve, "kg", profile.weight_kg);
  const a = interpolateCurve(
    norm.age_factor_curve,
    "age",
    ageAt(profile.birth_date, refDate),
  );
  const g = genderFactor(profile.gender, norm.gender_factor);
  return norm.base_target * w * a * g;
}

function rankFor(score: number): CrsRank {
  if (score >= 95) return { letter: "S", name: "Shadow Monarch" };
  if (score >= 80) return { letter: "A", name: "Hunter Elite" };
  if (score >= 65) return { letter: "B", name: "Rising Fighter" };
  if (score >= 50) return { letter: "C", name: "Contender" };
  if (score >= 35) return { letter: "D", name: "Recruit" };
  return { letter: "E", name: "Awakening" };
}

function archetypeFor(per: Record<CrsExerciseKey, number>): CrsArchetype {
  // Top-2 Schluessel nach score (mit stabiler Reihenfolge bei Ties).
  const sorted = (Object.keys(per) as CrsExerciseKey[]).sort(
    (a, b) => per[b] - per[a] || CRS_EXERCISES.indexOf(a) - CRS_EXERCISES.indexOf(b),
  );
  const top = new Set([sorted[0], sorted[1]]);
  const has = (a: CrsExerciseKey, b: CrsExerciseKey) => top.has(a) && top.has(b);
  if (has("plank", "squats")) return "Tank";
  if (has("high_knees", "burpees")) return "Assassin";
  if (has("plank", "pushups")) return "Guardian";
  if (has("burpees", "squats")) return "Berserker";
  return "Rookie";
}

export function computeCrsScore(input: {
  raw: CrsRawValues;
  norms: CrsNormRow[];
  profile: AthleteProfile;
  refDate?: Date;
}): CrsScoreOutput {
  const refDate = input.refDate ?? new Date();
  const normMap = new Map(input.norms.map((n) => [n.exercise, n]));

  const per: Partial<Record<CrsExerciseKey, number>> = {};
  const targets: Partial<Record<CrsExerciseKey, number>> = {};
  let zeros = 0;

  for (const ex of CRS_EXERCISES) {
    const norm = normMap.get(ex);
    const rawValue = input.raw[RAW_TO_KEY[ex]];
    if (!norm) {
      // Fehlende Norm-Zeile: Default-Score 0, Logging via Edge-Function.
      per[ex] = 0;
      targets[ex] = 0;
      zeros += 1;
      continue;
    }
    const target = personalizedTarget(norm, input.profile, refDate);
    targets[ex] = target;
    if (rawValue == null || rawValue === 0 || target <= 0) {
      per[ex] = 0;
      zeros += 1;
      continue;
    }
    const raw = Math.min(100, (rawValue / target) * 100);
    per[ex] = Math.max(0, raw);
  }

  const perFull = per as Record<CrsExerciseKey, number>;
  const targetsFull = targets as Record<CrsExerciseKey, number>;

  if (zeros >= 2) {
    return {
      score: null,
      rank: null,
      archetype: null,
      per_exercise: perFull,
      invalid_reason: "too_many_zeros",
      reduced_scope: false,
      targets: targetsFull,
    };
  }

  const nonZero = (Object.values(perFull) as number[]).filter((v) => v > 0);
  const sum = nonZero.reduce((s, v) => s + v, 0);
  const mean = nonZero.length === 0 ? 0 : sum / nonZero.length;
  const score = Math.round(mean);

  return {
    score,
    rank: rankFor(score),
    archetype: archetypeFor(perFull),
    per_exercise: perFull,
    invalid_reason: null,
    reduced_scope: zeros === 1,
    targets: targetsFull,
  };
}
