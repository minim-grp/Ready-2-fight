import { describe, it, expect } from "vitest";
import {
  validateCodeForm,
  hasErrors,
  mapRpcError,
  formatExpiresAt,
  deriveCodeStatus,
  statusLabel,
  DEFAULT_CODE_FORM,
} from "./engagementCode";

describe("validateCodeForm", () => {
  it("akzeptiert Default-Werte", () => {
    expect(hasErrors(validateCodeForm(DEFAULT_CODE_FORM))).toBe(false);
  });

  it("lehnt zu langes internal label ab", () => {
    const errors = validateCodeForm({
      ...DEFAULT_CODE_FORM,
      internalLabel: "x".repeat(51),
    });
    expect(errors.internalLabel).toMatch(/50 Zeichen/);
  });

  it("akzeptiert leeres internal label (optional)", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, internalLabel: "" });
    expect(errors.internalLabel).toBeUndefined();
  });

  it("lehnt max_uses < 1 ab", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, maxUses: "0" });
    expect(errors.maxUses).toBeTruthy();
  });

  it("lehnt max_uses > 10 ab", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, maxUses: "11" });
    expect(errors.maxUses).toBeTruthy();
  });

  it("lehnt nicht-ganzzahlige max_uses ab", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, maxUses: "1.5" });
    expect(errors.maxUses).toBeTruthy();
  });

  it("lehnt valid_days < 1 ab", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, validDays: "0" });
    expect(errors.validDays).toBeTruthy();
  });

  it("lehnt valid_days > 30 ab (matcht RPC-Grenze)", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, validDays: "31" });
    expect(errors.validDays).toBeTruthy();
  });

  it("lehnt leeres valid_days ab", () => {
    const errors = validateCodeForm({ ...DEFAULT_CODE_FORM, validDays: "" });
    expect(errors.validDays).toBeTruthy();
  });
});

describe("mapRpcError", () => {
  it("mappt not_a_coach auf deutsche Meldung", () => {
    expect(mapRpcError(new Error("not_a_coach"))).toMatch(/Coaches/i);
  });

  it("mappt not_authenticated auf Session-Hinweis", () => {
    expect(mapRpcError(new Error("not_authenticated"))).toMatch(/neu anmelden/i);
  });

  it("mappt valid_days_out_of_range auf Bereichs-Hinweis", () => {
    expect(mapRpcError(new Error("valid_days_out_of_range"))).toMatch(/30 Tagen/);
  });

  it("fallback-Meldung fuer unbekannte Fehler", () => {
    expect(mapRpcError(new Error("boom"))).toMatch(/konnte nicht/i);
  });

  it("akzeptiert Non-Error Values", () => {
    expect(mapRpcError("wirr")).toMatch(/konnte nicht/i);
  });
});

describe("formatExpiresAt", () => {
  it("formatiert ISO-Datum als DD.MM.YYYY", () => {
    expect(formatExpiresAt("2026-04-26T10:00:00Z")).toBe("26.04.2026");
  });

  it("liefert Roh-String bei ungueltigem Datum zurueck", () => {
    expect(formatExpiresAt("nicht-ein-datum")).toBe("nicht-ein-datum");
  });
});

describe("deriveCodeStatus", () => {
  const future = "2099-01-01T00:00:00Z";
  const past = "2000-01-01T00:00:00Z";

  it("revoked schlaegt alles", () => {
    expect(
      deriveCodeStatus({
        uses_count: 0,
        max_uses: 1,
        expires_at: future,
        revoked_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe("revoked");
  });

  it("expired wenn expires_at in der Vergangenheit", () => {
    expect(
      deriveCodeStatus({
        uses_count: 0,
        max_uses: 1,
        expires_at: past,
        revoked_at: null,
      }),
    ).toBe("expired");
  });

  it("exhausted wenn uses_count == max_uses", () => {
    expect(
      deriveCodeStatus({
        uses_count: 1,
        max_uses: 1,
        expires_at: future,
        revoked_at: null,
      }),
    ).toBe("exhausted");
  });

  it("active sonst", () => {
    expect(
      deriveCodeStatus({
        uses_count: 0,
        max_uses: 2,
        expires_at: future,
        revoked_at: null,
      }),
    ).toBe("active");
  });

  it("expired vor exhausted (revoked beats them, exhausted only if not expired)", () => {
    expect(
      deriveCodeStatus({
        uses_count: 1,
        max_uses: 1,
        expires_at: past,
        revoked_at: null,
      }),
    ).toBe("expired");
  });
});

describe("statusLabel", () => {
  it("liefert deutsche Labels", () => {
    expect(statusLabel("active")).toBe("aktiv");
    expect(statusLabel("exhausted")).toBe("eingeloest");
    expect(statusLabel("expired")).toBe("abgelaufen");
    expect(statusLabel("revoked")).toBe("widerrufen");
  });
});
