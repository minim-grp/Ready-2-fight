import { describe, it, expect } from "vitest";
import { isInKarenz } from "./streak";

const NOW = new Date("2026-04-19T10:00:00Z");

describe("isInKarenz", () => {
  it("liefert false ohne last_tracked_date", () => {
    expect(isInKarenz(null, 5, NOW)).toBe(false);
  });

  it("liefert false bei current_streak null", () => {
    expect(isInKarenz("2026-04-18", null, NOW)).toBe(false);
  });

  it("liefert false bei current_streak 0", () => {
    expect(isInKarenz("2026-04-18", 0, NOW)).toBe(false);
  });

  it("liefert false wenn heute bereits getrackt", () => {
    expect(isInKarenz("2026-04-19", 5, NOW)).toBe(false);
  });

  it("liefert true wenn gestern getrackt und Streak aktiv", () => {
    expect(isInKarenz("2026-04-18", 5, NOW)).toBe(true);
  });

  it("liefert true wenn vor 3 Tagen getrackt (noch innerhalb 4-Tage-Fenster)", () => {
    expect(isInKarenz("2026-04-16", 5, NOW)).toBe(true);
  });

  it("liefert false wenn Deadline exakt now entspricht (strikt groesser)", () => {
    const boundary = new Date("2026-04-19T00:00:00Z");
    expect(isInKarenz("2026-04-15", 5, boundary)).toBe(false);
  });

  it("liefert false wenn vor 4 Tagen getrackt und Deadline ueberschritten", () => {
    expect(isInKarenz("2026-04-15", 5, NOW)).toBe(false);
  });

  it("liefert false bei ungueltigem Datum", () => {
    expect(isInKarenz("nicht-ein-datum", 5, NOW)).toBe(false);
  });
});
