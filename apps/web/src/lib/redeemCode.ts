// Code-Format laut foundation.sql §14: 8 Zeichen, [A-HJ-NP-Z2-9]
// (uppercase, ohne 0/O/1/I). Athlet kann mit oder ohne Leerzeichen tippen.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidCodeShape(code: string): boolean {
  return CODE_RE.test(code);
}

export function validateCodeInput(rawCode: string): string | undefined {
  const code = normalizeCode(rawCode);
  if (code.length === 0) return "Bitte Code eingeben.";
  if (code.length !== 8) return "Code besteht aus genau 8 Zeichen.";
  if (!isValidCodeShape(code)) {
    return "Code enthaelt ungueltige Zeichen (nur A–Z ohne O/I, 2–9).";
  }
  return undefined;
}

export function mapRedeemError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("not_authenticated")) {
    return "Sitzung abgelaufen — bitte neu anmelden.";
  }
  if (raw.includes("not_an_athlete")) {
    return "Nur Athleten koennen Codes einloesen.";
  }
  if (raw.includes("invalid_code")) {
    return "Code unbekannt. Tippfehler?";
  }
  if (raw.includes("code_revoked")) {
    return "Dieser Code wurde widerrufen.";
  }
  if (raw.includes("code_expired")) {
    return "Dieser Code ist abgelaufen.";
  }
  if (raw.includes("code_exhausted")) {
    return "Dieser Code wurde bereits oft genug eingeloest.";
  }
  if (raw.includes("cannot_redeem_own_code")) {
    return "Du kannst deinen eigenen Code nicht einloesen.";
  }
  return "Code konnte nicht eingeloest werden.";
}
