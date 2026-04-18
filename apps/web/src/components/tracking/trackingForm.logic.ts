import type { Database } from "../../lib/database.types";
import type {
  DailyTracking,
  DailyTrackingInput,
} from "../../hooks/queries/useDailyTracking";

export type Quality = Database["public"]["Enums"]["sleep_quality"];
export type Activity = Database["public"]["Enums"]["activity_level"];

export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: "gut", label: "Gut" },
  { value: "mittel", label: "Mittel" },
  { value: "schlecht", label: "Schlecht" },
];

export const ACTIVITY_OPTIONS: { value: Activity; label: string }[] = [
  { value: "keine", label: "Keine" },
  { value: "moderat", label: "Moderat" },
  { value: "hoch", label: "Hoch" },
  { value: "extrem", label: "Extrem" },
];

export type TrackingFormState = {
  sleep_quality: Quality | "";
  weight_kg: string;
  mood: Quality | "";
  water_l: string;
  physical_condition: Quality | "";
  calories_kcal: string;
  activity_level: Activity | "";
  trained: boolean;
  rpe: string;
  duration_min: string;
  soreness: boolean;
  soreness_region: string;
};

export const EMPTY_TRACKING_FORM: TrackingFormState = {
  sleep_quality: "",
  weight_kg: "",
  mood: "",
  water_l: "",
  physical_condition: "",
  calories_kcal: "",
  activity_level: "",
  trained: false,
  rpe: "",
  duration_min: "",
  soreness: false,
  soreness_region: "",
};

export function hydrateTrackingForm(row: DailyTracking | null): TrackingFormState {
  if (!row) return EMPTY_TRACKING_FORM;
  return {
    sleep_quality: row.sleep_quality ?? "",
    weight_kg: row.weight_kg != null ? String(row.weight_kg) : "",
    mood: row.mood ?? "",
    water_l: row.water_l != null ? String(row.water_l) : "",
    physical_condition: row.physical_condition ?? "",
    calories_kcal: row.calories_kcal != null ? String(row.calories_kcal) : "",
    activity_level: row.activity_level ?? "",
    trained: row.trained,
    rpe: row.rpe != null ? String(row.rpe) : "",
    duration_min: row.duration_min != null ? String(row.duration_min) : "",
    soreness: row.soreness,
    soreness_region: row.soreness_region ?? "",
  };
}

export function validateTrackingForm(s: TrackingFormState): string | null {
  if (!s.sleep_quality) return "Schlafqualitaet ist Pflicht.";
  if (!s.weight_kg) return "Gewicht ist Pflicht.";
  const w = parseFloat(s.weight_kg);
  if (Number.isNaN(w) || w < 30 || w > 300)
    return "Gewicht muss zwischen 30 und 300 kg liegen.";
  if (!s.mood) return "Stimmung ist Pflicht.";
  if (!s.water_l) return "Wasserkonsum ist Pflicht.";
  const water = parseFloat(s.water_l);
  if (Number.isNaN(water) || water < 0 || water > 10)
    return "Wasser muss zwischen 0 und 10 l liegen.";
  if (!s.physical_condition) return "Koerperlicher Zustand ist Pflicht.";
  if (s.calories_kcal) {
    const c = parseInt(s.calories_kcal, 10);
    if (Number.isNaN(c) || c < 0 || c > 10000)
      return "Kalorien muss zwischen 0 und 10.000 liegen.";
  }
  if (s.trained) {
    if (s.rpe) {
      const r = parseInt(s.rpe, 10);
      if (Number.isNaN(r) || r < 1 || r > 10) return "RPE muss 1 bis 10 sein.";
    }
    if (s.duration_min) {
      const d = parseInt(s.duration_min, 10);
      if (Number.isNaN(d) || d < 0 || d > 600)
        return "Dauer muss 0 bis 600 Minuten sein.";
    }
  }
  if (s.soreness && !s.soreness_region.trim())
    return "Koerperregion bei Muskelkater angeben.";
  return null;
}

export function trackingFormToInput(s: TrackingFormState): DailyTrackingInput {
  return {
    sleep_quality: s.sleep_quality || null,
    weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
    mood: s.mood || null,
    water_l: s.water_l ? parseFloat(s.water_l) : null,
    physical_condition: s.physical_condition || null,
    calories_kcal: s.calories_kcal ? parseInt(s.calories_kcal, 10) : null,
    activity_level: s.activity_level || null,
    trained: s.trained,
    rpe: s.trained && s.rpe ? parseInt(s.rpe, 10) : null,
    duration_min: s.trained && s.duration_min ? parseInt(s.duration_min, 10) : null,
    soreness: s.soreness,
    soreness_region:
      s.soreness && s.soreness_region.trim() ? s.soreness_region.trim() : null,
  };
}
