import { describe, expect, it } from "vitest";
import {
  EMPTY_PLAN_FORM,
  planFormToInput,
  validatePlanForm,
  type PlanFormState,
} from "./planForm.logic";

function form(overrides: Partial<PlanFormState> = {}): PlanFormState {
  return { ...EMPTY_PLAN_FORM, title: "Wettkampf-Vorbereitung", ...overrides };
}

describe("validatePlanForm", () => {
  it("akzeptiert minimal gueltigen Template-Plan", () => {
    expect(validatePlanForm(form())).toBeNull();
  });

  it("verlangt Titel", () => {
    expect(validatePlanForm(form({ title: "" }))).toMatch(/Titel/);
    expect(validatePlanForm(form({ title: "   " }))).toMatch(/Titel/);
  });

  it("kappt Titel bei 120 Zeichen", () => {
    expect(validatePlanForm(form({ title: "x".repeat(121) }))).toMatch(/120/);
  });

  it("verlangt Athlet wenn nicht Template", () => {
    expect(validatePlanForm(form({ is_template: false, athlete_id: "" }))).toMatch(
      /Athlet/,
    );
    expect(validatePlanForm(form({ is_template: false, athlete_id: "u-1" }))).toBeNull();
  });

  it("verbietet Ende vor Start", () => {
    expect(
      validatePlanForm(form({ starts_on: "2026-05-10", ends_on: "2026-05-01" })),
    ).toMatch(/Ende/);
    expect(
      validatePlanForm(form({ starts_on: "2026-05-01", ends_on: "2026-05-10" })),
    ).toBeNull();
  });
});

describe("planFormToInput", () => {
  it("trimmt Titel und Beschreibung", () => {
    const input = planFormToInput(form({ title: "  Plan  ", description: "  desc  " }));
    expect(input.title).toBe("Plan");
    expect(input.description).toBe("desc");
  });

  it("setzt leere Beschreibung auf null", () => {
    expect(planFormToInput(form({ description: "" })).description).toBeNull();
  });

  it("verwirft athlete_id wenn Template", () => {
    const input = planFormToInput(form({ is_template: true, athlete_id: "u-1" }));
    expect(input.athlete_id).toBeNull();
  });

  it("setzt athlete_id wenn nicht Template", () => {
    const input = planFormToInput(form({ is_template: false, athlete_id: "u-1" }));
    expect(input.athlete_id).toBe("u-1");
  });

  it("setzt leere Daten auf null", () => {
    const input = planFormToInput(form());
    expect(input.starts_on).toBeNull();
    expect(input.ends_on).toBeNull();
  });
});
