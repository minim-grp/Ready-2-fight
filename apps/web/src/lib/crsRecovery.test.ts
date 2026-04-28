import { describe, it, expect, beforeEach } from "vitest";
import {
  clearCrsRecovery,
  loadCrsRecovery,
  newCrsClientUuid,
  saveCrsRecovery,
} from "./crsRecovery";

const KEY = "r2f.crs.recovery";

describe("crsRecovery storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("save + load round-trip behaelt step-shape", () => {
    saveCrsRecovery({
      clientUuid: "uuid-a",
      testId: "test-1",
      step: { kind: "exercise", index: 2, phase: "input" },
      accepted: true,
    });
    const loaded = loadCrsRecovery();
    expect(loaded).toEqual({
      version: 1,
      clientUuid: "uuid-a",
      testId: "test-1",
      step: { kind: "exercise", index: 2, phase: "input" },
      accepted: true,
    });
  });

  it("load gibt null zurueck wenn nichts gespeichert", () => {
    expect(loadCrsRecovery()).toBeNull();
  });

  it("load gibt null bei kaputtem JSON", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadCrsRecovery()).toBeNull();
  });

  it("load lehnt fremde Schema-Version ab", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 999,
        clientUuid: "u",
        testId: null,
        step: { kind: "disclaimer" },
        accepted: false,
      }),
    );
    expect(loadCrsRecovery()).toBeNull();
  });

  it("load lehnt unbekannten step.kind ab", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        clientUuid: "u",
        testId: null,
        step: { kind: "unknown" },
        accepted: false,
      }),
    );
    expect(loadCrsRecovery()).toBeNull();
  });

  it("load lehnt invalide warmup-round ab", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        clientUuid: "u",
        testId: null,
        step: { kind: "warmup", round: 5 },
        accepted: false,
      }),
    );
    expect(loadCrsRecovery()).toBeNull();
  });

  it("clear loescht den Eintrag", () => {
    saveCrsRecovery({
      clientUuid: "u",
      testId: null,
      step: { kind: "disclaimer" },
      accepted: false,
    });
    clearCrsRecovery();
    expect(loadCrsRecovery()).toBeNull();
  });

  it("newCrsClientUuid liefert unterschiedliche Werte", () => {
    const a = newCrsClientUuid();
    const b = newCrsClientUuid();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
