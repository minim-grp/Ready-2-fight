import { describe, it, expect } from "vitest";
import { buildHistoryGrid, startOfWindowIso } from "./trackingHistory";

const TODAY = new Date("2026-04-19T10:00:00Z");

describe("buildHistoryGrid", () => {
  it("liefert 7 Eintraege fuer windowDays=7, alle untracked bei leerer Liste", () => {
    const grid = buildHistoryGrid([], 7, TODAY);
    expect(grid).toHaveLength(7);
    expect(grid.every((d) => !d.tracked)).toBe(true);
  });

  it("liefert 30 Eintraege fuer windowDays=30", () => {
    const grid = buildHistoryGrid([], 30, TODAY);
    expect(grid).toHaveLength(30);
  });

  it("ordnet aelteste zuerst, juengste zuletzt", () => {
    const grid = buildHistoryGrid([], 7, TODAY);
    expect(grid[0]!.date).toBe("2026-04-13");
    expect(grid[grid.length - 1]!.date).toBe("2026-04-19");
  });

  it("markiert exakt die Tage als tracked, fuer die ein Datum geliefert wird", () => {
    const grid = buildHistoryGrid(["2026-04-19", "2026-04-17", "2026-04-13"], 7, TODAY);
    expect(grid.find((d) => d.date === "2026-04-19")?.tracked).toBe(true);
    expect(grid.find((d) => d.date === "2026-04-17")?.tracked).toBe(true);
    expect(grid.find((d) => d.date === "2026-04-13")?.tracked).toBe(true);
    expect(grid.find((d) => d.date === "2026-04-18")?.tracked).toBe(false);
    expect(grid.find((d) => d.date === "2026-04-14")?.tracked).toBe(false);
  });

  it("ignoriert Datumsangaben ausserhalb des Fensters", () => {
    const grid = buildHistoryGrid(["2026-04-01", "2026-04-19"], 7, TODAY);
    expect(grid.filter((d) => d.tracked)).toHaveLength(1);
    expect(grid[grid.length - 1]!.tracked).toBe(true);
  });

  it("nutzt UTC-Mitternacht und ist unabhaengig von der Tageszeit", () => {
    const earlyMorning = new Date("2026-04-19T00:30:00Z");
    const lateNight = new Date("2026-04-19T23:30:00Z");
    expect(buildHistoryGrid([], 7, earlyMorning)[6]!.date).toBe("2026-04-19");
    expect(buildHistoryGrid([], 7, lateNight)[6]!.date).toBe("2026-04-19");
  });

  it("rechnet ueber Monatsgrenzen korrekt", () => {
    const marchFirst = new Date("2026-03-01T10:00:00Z");
    const grid = buildHistoryGrid(["2026-02-28"], 7, marchFirst);
    expect(grid[0]!.date).toBe("2026-02-23");
    expect(grid[grid.length - 1]!.date).toBe("2026-03-01");
    expect(grid.find((d) => d.date === "2026-02-28")?.tracked).toBe(true);
  });

  it("rechnet ueber Jahresgrenzen korrekt", () => {
    const newYear = new Date("2026-01-02T10:00:00Z");
    const grid = buildHistoryGrid([], 7, newYear);
    expect(grid[0]!.date).toBe("2025-12-27");
    expect(grid[grid.length - 1]!.date).toBe("2026-01-02");
  });
});

describe("startOfWindowIso", () => {
  it("liefert das aelteste Datum im 7-Tage-Fenster", () => {
    expect(startOfWindowIso(TODAY, 7)).toBe("2026-04-13");
  });

  it("liefert das aelteste Datum im 30-Tage-Fenster", () => {
    expect(startOfWindowIso(TODAY, 30)).toBe("2026-03-21");
  });
});
