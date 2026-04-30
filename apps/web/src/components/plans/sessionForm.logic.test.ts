import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION_FORM,
  neighborForSwap,
  nextSessionPosition,
  sessionFormToInput,
  validateSessionForm,
  type SessionFormState,
} from "./sessionForm.logic";
import type { PlanSession } from "../../hooks/queries/usePlans";

function form(overrides: Partial<SessionFormState> = {}): SessionFormState {
  return { ...EMPTY_SESSION_FORM, title: "Kraft", day_offset: "1", ...overrides };
}

function session(id: string, position: number, day = 0): PlanSession {
  return {
    id,
    plan_id: "p1",
    day_offset: day,
    title: id,
    notes: null,
    position,
  };
}

describe("validateSessionForm", () => {
  it("akzeptiert minimal gueltige Form", () => {
    expect(validateSessionForm(form())).toBeNull();
  });

  it("verlangt Titel", () => {
    expect(validateSessionForm(form({ title: "" }))).toMatch(/Titel/);
    expect(validateSessionForm(form({ title: "   " }))).toMatch(/Titel/);
  });

  it("kappt Titel bei 120 Zeichen", () => {
    expect(validateSessionForm(form({ title: "x".repeat(121) }))).toMatch(/120/);
  });

  it("kappt Notizen bei 2000 Zeichen", () => {
    expect(validateSessionForm(form({ notes: "x".repeat(2001) }))).toMatch(/2000/);
  });

  it("verlangt Tag als ganze Zahl 0–365", () => {
    expect(validateSessionForm(form({ day_offset: "" }))).toMatch(/Tag/);
    expect(validateSessionForm(form({ day_offset: "abc" }))).toMatch(/ganze Zahl/);
    expect(validateSessionForm(form({ day_offset: "1.5" }))).toMatch(/ganze Zahl/);
    expect(validateSessionForm(form({ day_offset: "-1" }))).toMatch(/0 und 365/);
    expect(validateSessionForm(form({ day_offset: "366" }))).toMatch(/0 und 365/);
    expect(validateSessionForm(form({ day_offset: "0" }))).toBeNull();
    expect(validateSessionForm(form({ day_offset: "365" }))).toBeNull();
  });
});

describe("sessionFormToInput", () => {
  it("trimmt Title und Notes, parsed day_offset, setzt position", () => {
    const input = sessionFormToInput(
      form({ title: "  Kraft  ", notes: "  los  ", day_offset: "5" }),
      "plan-1",
      7,
    );
    expect(input).toEqual({
      plan_id: "plan-1",
      title: "Kraft",
      notes: "los",
      day_offset: 5,
      position: 7,
    });
  });

  it("setzt leere Notes auf null", () => {
    expect(sessionFormToInput(form({ notes: "" }), "p", 0).notes).toBeNull();
  });
});

describe("nextSessionPosition", () => {
  it("liefert 0 bei leerer Liste", () => {
    expect(nextSessionPosition([])).toBe(0);
  });

  it("liefert max(position) + 1", () => {
    expect(nextSessionPosition([session("a", 0), session("b", 4), session("c", 2)])).toBe(
      5,
    );
  });
});

describe("neighborForSwap", () => {
  const list = [session("a", 0), session("b", 1), session("c", 2)];

  it("liefert null beim ersten Eintrag mit up", () => {
    expect(neighborForSwap(list, list[0]!, "up")).toBeNull();
  });

  it("liefert null beim letzten Eintrag mit down", () => {
    expect(neighborForSwap(list, list[2]!, "down")).toBeNull();
  });

  it("up-Neighbor ist der vorherige", () => {
    expect(neighborForSwap(list, list[1]!, "up")?.id).toBe("a");
  });

  it("down-Neighbor ist der naechste", () => {
    expect(neighborForSwap(list, list[1]!, "down")?.id).toBe("c");
  });

  it("liefert null wenn current nicht in der Liste", () => {
    expect(neighborForSwap(list, session("z", 99), "up")).toBeNull();
  });
});
