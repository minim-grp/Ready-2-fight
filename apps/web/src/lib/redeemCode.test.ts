import { describe, it, expect } from "vitest";
import {
  normalizeCode,
  isValidCodeShape,
  validateCodeInput,
  mapRedeemError,
} from "./redeemCode";

describe("normalizeCode", () => {
  it("trimmt und uppercased", () => {
    expect(normalizeCode("  ab12cd34  ")).toBe("AB12CD34");
  });
  it("entfernt alle Whitespaces", () => {
    expect(normalizeCode("AB 12 CD 34")).toBe("AB12CD34");
  });
});

describe("isValidCodeShape", () => {
  it("akzeptiert gueltigen 8-Zeichen-Code", () => {
    expect(isValidCodeShape("AB23CD45")).toBe(true);
  });
  it("lehnt 0/O/1/I ab", () => {
    expect(isValidCodeShape("AB0OCD1I")).toBe(false);
  });
  it("lehnt Kleinbuchstaben ab", () => {
    expect(isValidCodeShape("ab23cd45")).toBe(false);
  });
  it("lehnt falsche Laenge ab", () => {
    expect(isValidCodeShape("AB23CD")).toBe(false);
    expect(isValidCodeShape("AB23CD456")).toBe(false);
  });
});

describe("validateCodeInput", () => {
  it("liefert undefined bei gueltigem Code", () => {
    expect(validateCodeInput("AB23CD45")).toBeUndefined();
    expect(validateCodeInput("ab 23 cd 45")).toBeUndefined();
  });
  it("meldet leere Eingabe", () => {
    expect(validateCodeInput("")).toMatch(/eingeben/i);
    expect(validateCodeInput("   ")).toMatch(/eingeben/i);
  });
  it("meldet falsche Laenge", () => {
    expect(validateCodeInput("AB23")).toMatch(/8 Zeichen/);
  });
  it("meldet ungueltige Zeichen", () => {
    expect(validateCodeInput("AB23CD0I")).toMatch(/ungueltige Zeichen/i);
  });
});

describe("mapRedeemError", () => {
  it("mappt invalid_code", () => {
    expect(mapRedeemError(new Error("invalid_code"))).toMatch(/Tippfehler/);
  });
  it("mappt code_revoked", () => {
    expect(mapRedeemError(new Error("code_revoked"))).toMatch(/widerrufen/);
  });
  it("mappt code_expired", () => {
    expect(mapRedeemError(new Error("code_expired"))).toMatch(/abgelaufen/);
  });
  it("mappt code_exhausted", () => {
    expect(mapRedeemError(new Error("code_exhausted"))).toMatch(/oft genug/);
  });
  it("mappt cannot_redeem_own_code", () => {
    expect(mapRedeemError(new Error("cannot_redeem_own_code"))).toMatch(/eigenen/);
  });
  it("mappt not_an_athlete", () => {
    expect(mapRedeemError(new Error("not_an_athlete"))).toMatch(/Athleten/);
  });
  it("mappt not_authenticated", () => {
    expect(mapRedeemError(new Error("not_authenticated"))).toMatch(/neu anmelden/);
  });
  it("Fallback bei unbekanntem Fehler", () => {
    expect(mapRedeemError(new Error("boom"))).toMatch(/konnte nicht/i);
  });
  it("akzeptiert Non-Error", () => {
    expect(mapRedeemError("wirr")).toMatch(/konnte nicht/i);
  });
});
