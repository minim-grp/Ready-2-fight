import type { PlanSession, CreateSessionInput } from "../../hooks/queries/usePlans";

export type SessionFormState = {
  title: string;
  day_offset: string;
  notes: string;
};

export const EMPTY_SESSION_FORM: SessionFormState = {
  title: "",
  day_offset: "0",
  notes: "",
};

export function validateSessionForm(s: SessionFormState): string | null {
  const title = s.title.trim();
  if (!title) return "Titel ist Pflicht.";
  if (title.length > 120) return "Titel darf maximal 120 Zeichen haben.";
  if (s.notes.length > 2000) return "Notizen duerfen maximal 2000 Zeichen haben.";
  if (s.day_offset === "") return "Tag ist Pflicht.";
  const day = Number(s.day_offset);
  if (!Number.isFinite(day) || !Number.isInteger(day))
    return "Tag muss eine ganze Zahl sein.";
  if (day < 0 || day > 365) return "Tag muss zwischen 0 und 365 liegen.";
  return null;
}

export function sessionFormToInput(
  s: SessionFormState,
  plan_id: string,
  position: number,
): CreateSessionInput {
  return {
    plan_id,
    title: s.title.trim(),
    day_offset: Number(s.day_offset),
    notes: s.notes.trim() ? s.notes.trim() : null,
    position,
  };
}

export function nextSessionPosition(sessions: ReadonlyArray<PlanSession>): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map((s) => s.position)) + 1;
}

// Liefert den Nachbarn fuer einen Up-/Down-Swap. null wenn am Rand.
export function neighborForSwap(
  sessions: ReadonlyArray<PlanSession>,
  current: PlanSession,
  direction: "up" | "down",
): PlanSession | null {
  const idx = sessions.findIndex((s) => s.id === current.id);
  if (idx < 0) return null;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= sessions.length) return null;
  return sessions[target] ?? null;
}
