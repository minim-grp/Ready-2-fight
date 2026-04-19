import { describe, it, expect } from "vitest";
import {
  endReasonLabel,
  mapLifecycleError,
  purposeLabel,
  statusLabel,
  statusStyle,
} from "./engagementLifecycle";

describe("statusLabel", () => {
  it("mappt alle Status auf deutsche Labels", () => {
    expect(statusLabel("pending")).toBe("wartet");
    expect(statusLabel("active")).toBe("aktiv");
    expect(statusLabel("paused")).toBe("pausiert");
    expect(statusLabel("ended")).toBe("beendet");
  });
});

describe("statusStyle", () => {
  it("liefert pro Status unterschiedliche Styles", () => {
    const styles = new Set([
      statusStyle("pending"),
      statusStyle("active"),
      statusStyle("paused"),
      statusStyle("ended"),
    ]);
    expect(styles.size).toBe(4);
  });
});

describe("purposeLabel", () => {
  it("mappt alle bekannten Purpose-Werte", () => {
    expect(purposeLabel("general")).toBe("Allgemein");
    expect(purposeLabel("competition_prep")).toBe("Wettkampfvorbereitung");
    expect(purposeLabel("technique")).toBe("Technik");
    expect(purposeLabel("strength_cond")).toBe("Kraft & Kondition");
    expect(purposeLabel("nutrition")).toBe("Ernaehrung");
    expect(purposeLabel("rehab")).toBe("Reha");
  });

  it("laesst unbekannte Werte durch", () => {
    expect(purposeLabel("custom_purpose")).toBe("custom_purpose");
  });
});

describe("endReasonLabel", () => {
  it("liefert null bei null/undefined", () => {
    expect(endReasonLabel(null)).toBeNull();
  });

  it("mappt die vier Reasons", () => {
    expect(endReasonLabel("completed")).toMatch(/abgeschlossen/i);
    expect(endReasonLabel("athlete_left")).toMatch(/Athlet/i);
    expect(endReasonLabel("coach_ended")).toMatch(/Coach/i);
    expect(endReasonLabel("mutual")).toMatch(/einvernehmlich/i);
  });
});

describe("mapLifecycleError", () => {
  it("mapt bekannte Fehler auf deutsche Texte", () => {
    expect(mapLifecycleError(new Error("not_authenticated"))).toMatch(/Sitzung/);
    expect(mapLifecycleError(new Error("engagement_not_found"))).toMatch(
      /nicht gefunden/,
    );
    expect(mapLifecycleError(new Error("engagement_not_active"))).toMatch(/aktive/);
    expect(mapLifecycleError(new Error("engagement_not_paused"))).toMatch(/pausiert/);
    expect(mapLifecycleError(new Error("engagement_already_ended"))).toMatch(/bereits/);
    expect(mapLifecycleError(new Error("invalid_end_reason"))).toMatch(/Ungueltiger/);
  });

  it("liefert Fallback bei unbekanntem Fehler", () => {
    expect(mapLifecycleError(new Error("weird"))).toMatch(/fehlgeschlagen/);
  });

  it("akzeptiert beliebige Werte", () => {
    expect(mapLifecycleError("not_authenticated")).toMatch(/Sitzung/);
    expect(mapLifecycleError(null)).toMatch(/fehlgeschlagen/);
  });
});
