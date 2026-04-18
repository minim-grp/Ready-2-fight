import { describe, expect, it } from "vitest";
import {
  EMPTY_TRACKING_FORM,
  hydrateTrackingForm,
  trackingFormToInput,
  validateTrackingForm,
  type TrackingFormState,
} from "./trackingForm.logic";
import type { DailyTracking } from "../../hooks/queries/useDailyTracking";

function validForm(overrides: Partial<TrackingFormState> = {}): TrackingFormState {
  return {
    ...EMPTY_TRACKING_FORM,
    sleep_quality: "gut",
    weight_kg: "75",
    mood: "gut",
    water_l: "2.5",
    physical_condition: "gut",
    ...overrides,
  };
}

describe("validateTrackingForm", () => {
  it("accepts valid Pflicht-Felder", () => {
    expect(validateTrackingForm(validForm())).toBeNull();
  });

  it("rejects missing Pflicht-Felder", () => {
    expect(validateTrackingForm(EMPTY_TRACKING_FORM)).toMatch(/Schlafqualitaet/);
    expect(validateTrackingForm(validForm({ sleep_quality: "" }))).toMatch(
      /Schlafqualitaet/,
    );
    expect(validateTrackingForm(validForm({ weight_kg: "" }))).toMatch(/Gewicht/);
    expect(validateTrackingForm(validForm({ mood: "" }))).toMatch(/Stimmung/);
    expect(validateTrackingForm(validForm({ water_l: "" }))).toMatch(/Wasserkonsum/);
    expect(validateTrackingForm(validForm({ physical_condition: "" }))).toMatch(
      /Zustand/,
    );
  });

  it("enforces Gewichts-Bereich 30-300 kg (PRD §06)", () => {
    expect(validateTrackingForm(validForm({ weight_kg: "29" }))).toMatch(/30 und 300/);
    expect(validateTrackingForm(validForm({ weight_kg: "301" }))).toMatch(/30 und 300/);
    expect(validateTrackingForm(validForm({ weight_kg: "30" }))).toBeNull();
  });

  it("enforces Wasser-Bereich 0-10 l", () => {
    expect(validateTrackingForm(validForm({ water_l: "11" }))).toMatch(/0 und 10/);
    expect(validateTrackingForm(validForm({ water_l: "0" }))).toBeNull();
  });

  it("enforces RPE 1-10 nur wenn trained", () => {
    expect(validateTrackingForm(validForm({ trained: true, rpe: "11" }))).toMatch(/RPE/);
    expect(validateTrackingForm(validForm({ trained: false, rpe: "99" }))).toBeNull();
  });

  it("verlangt Region wenn Muskelkater angegeben", () => {
    expect(
      validateTrackingForm(validForm({ soreness: true, soreness_region: "" })),
    ).toMatch(/Koerperregion/);
    expect(
      validateTrackingForm(validForm({ soreness: true, soreness_region: "Schultern" })),
    ).toBeNull();
  });
});

describe("trackingFormToInput", () => {
  it("setzt leere Strings auf null", () => {
    const input = trackingFormToInput(EMPTY_TRACKING_FORM);
    expect(input.sleep_quality).toBeNull();
    expect(input.weight_kg).toBeNull();
    expect(input.calories_kcal).toBeNull();
    expect(input.activity_level).toBeNull();
    expect(input.trained).toBe(false);
    expect(input.rpe).toBeNull();
  });

  it("verwirft RPE/Dauer wenn trained=false", () => {
    const input = trackingFormToInput(
      validForm({ trained: false, rpe: "8", duration_min: "60" }),
    );
    expect(input.rpe).toBeNull();
    expect(input.duration_min).toBeNull();
  });

  it("verwirft soreness_region wenn soreness=false", () => {
    const input = trackingFormToInput(
      validForm({ soreness: false, soreness_region: "Beine" }),
    );
    expect(input.soreness_region).toBeNull();
  });

  it("parst Gewicht als float", () => {
    const input = trackingFormToInput(validForm({ weight_kg: "75.5" }));
    expect(input.weight_kg).toBe(75.5);
  });
});

describe("hydrateTrackingForm", () => {
  it("returns EMPTY for null", () => {
    expect(hydrateTrackingForm(null)).toEqual(EMPTY_TRACKING_FORM);
  });

  it("maps DailyTracking row to FormState", () => {
    const row: DailyTracking = {
      id: "test",
      athlete_id: "a",
      date: "2026-04-18",
      sleep_quality: "mittel",
      weight_kg: 72.3,
      mood: "gut",
      water_l: 2,
      physical_condition: "schlecht",
      calories_kcal: 2200,
      activity_level: "moderat",
      trained: true,
      rpe: 7,
      duration_min: 45,
      srpe: 315,
      soreness: true,
      soreness_region: "Schultern",
      notes: null,
      engagement_id: null,
      client_uuid: null,
      created_at: "2026-04-18T00:00:00Z",
      updated_at: "2026-04-18T00:00:00Z",
    };
    const form = hydrateTrackingForm(row);
    expect(form.sleep_quality).toBe("mittel");
    expect(form.weight_kg).toBe("72.3");
    expect(form.activity_level).toBe("moderat");
    expect(form.trained).toBe(true);
    expect(form.rpe).toBe("7");
    expect(form.soreness_region).toBe("Schultern");
  });
});
