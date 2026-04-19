export type CodeFormValues = {
  internalLabel: string;
  maxUses: string;
  validDays: string;
};

export type CodeFormErrors = {
  internalLabel?: string;
  maxUses?: string;
  validDays?: string;
};

export const DEFAULT_CODE_FORM: CodeFormValues = {
  internalLabel: "",
  maxUses: "1",
  validDays: "7",
};

const LABEL_MAX = 50;
const USES_MIN = 1;
const USES_MAX = 10;
const DAYS_MIN = 1;
const DAYS_MAX = 30;

export function validateCodeForm(v: CodeFormValues): CodeFormErrors {
  const errors: CodeFormErrors = {};

  if (v.internalLabel.length > LABEL_MAX) {
    errors.internalLabel = `Max. ${LABEL_MAX} Zeichen.`;
  }

  const uses = Number(v.maxUses);
  if (!Number.isInteger(uses) || uses < USES_MIN || uses > USES_MAX) {
    errors.maxUses = `Zwischen ${USES_MIN} und ${USES_MAX}.`;
  }

  const days = Number(v.validDays);
  if (!Number.isInteger(days) || days < DAYS_MIN || days > DAYS_MAX) {
    errors.validDays = `Zwischen ${DAYS_MIN} und ${DAYS_MAX} Tagen.`;
  }

  return errors;
}

export function hasErrors(errors: CodeFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function mapRpcError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("not_a_coach")) {
    return "Nur Coaches koennen Codes generieren.";
  }
  if (raw.includes("not_authenticated")) {
    return "Sitzung abgelaufen — bitte neu anmelden.";
  }
  if (raw.includes("valid_days_out_of_range")) {
    return "Gueltigkeitsdauer muss zwischen 1 und 30 Tagen liegen.";
  }
  return "Code konnte nicht erstellt werden.";
}

export function formatExpiresAt(iso: string, locale = "de-DE"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
