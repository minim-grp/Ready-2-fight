import { describe, expect, it } from "vitest";
import {
  EMPTY_COMPETITION_FORM,
  competitionFormToInput,
  hydrateCompetitionForm,
  validateCompetitionForm,
  type CompetitionFormState,
} from "./competitionForm.logic";

function valid(overrides: Partial<CompetitionFormState> = {}): CompetitionFormState {
  return {
    ...EMPTY_COMPETITION_FORM,
    title: "Bayerische Meisterschaft",
    competition_date: "2026-06-15",
    ...overrides,
  };
}

describe("validateCompetitionForm", () => {
  it("acceptiert valide Pflichtfelder", () => {
    expect(validateCompetitionForm(valid())).toBeNull();
  });

  it("verlangt Titel", () => {
    expect(validateCompetitionForm(valid({ title: "" }))).toMatch(/Titel/);
    expect(validateCompetitionForm(valid({ title: "   " }))).toMatch(/Titel/);
  });

  it("limitiert Titel auf 120 Zeichen", () => {
    expect(validateCompetitionForm(valid({ title: "x".repeat(121) }))).toMatch(/120/);
    expect(validateCompetitionForm(valid({ title: "x".repeat(120) }))).toBeNull();
  });

  it("verlangt Datum", () => {
    expect(validateCompetitionForm(valid({ competition_date: "" }))).toMatch(/Datum/);
  });

  it("limitiert Notizen auf 2000 Zeichen", () => {
    expect(validateCompetitionForm(valid({ notes: "x".repeat(2001) }))).toMatch(
      /Notizen/,
    );
    expect(validateCompetitionForm(valid({ notes: "x".repeat(2000) }))).toBeNull();
  });

  it("limitiert kurze Felder auf 200 Zeichen", () => {
    expect(validateCompetitionForm(valid({ discipline: "x".repeat(201) }))).toMatch(
      /Disziplin/,
    );
    expect(validateCompetitionForm(valid({ weight_class: "x".repeat(201) }))).toMatch(
      /Gewichtsklasse/,
    );
    expect(validateCompetitionForm(valid({ location: "x".repeat(201) }))).toMatch(/Ort/);
    expect(validateCompetitionForm(valid({ result: "x".repeat(201) }))).toMatch(
      /Ergebnis/,
    );
  });
});

describe("competitionFormToInput", () => {
  it("trimt Titel und mappt leere Strings auf null", () => {
    const input = competitionFormToInput(
      valid({ title: "  Cup  ", discipline: "  ", notes: "" }),
    );
    expect(input.title).toBe("Cup");
    expect(input.discipline).toBeNull();
    expect(input.notes).toBeNull();
  });

  it("uebernimmt belegte Felder", () => {
    const input = competitionFormToInput(
      valid({
        discipline: "Boxen",
        weight_class: "-72 kg",
        location: "Muenchen",
        result: "Sieg KO",
        notes: "guter Tag",
      }),
    );
    expect(input.discipline).toBe("Boxen");
    expect(input.weight_class).toBe("-72 kg");
    expect(input.location).toBe("Muenchen");
    expect(input.result).toBe("Sieg KO");
    expect(input.notes).toBe("guter Tag");
  });
});

describe("hydrateCompetitionForm", () => {
  it("returns EMPTY for null", () => {
    expect(hydrateCompetitionForm(null)).toEqual(EMPTY_COMPETITION_FORM);
  });

  it("mappt Competition row to FormState (null → '')", () => {
    const form = hydrateCompetitionForm({
      title: "Cup",
      competition_date: "2026-06-15",
      discipline: null,
      weight_class: "-72 kg",
      location: null,
      result: null,
      notes: "Note",
    });
    expect(form.title).toBe("Cup");
    expect(form.competition_date).toBe("2026-06-15");
    expect(form.discipline).toBe("");
    expect(form.weight_class).toBe("-72 kg");
    expect(form.notes).toBe("Note");
  });
});
