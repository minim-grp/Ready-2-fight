import type { PlanInput } from "../../hooks/queries/usePlans";

export type PlanFormState = {
  title: string;
  description: string;
  is_template: boolean;
  athlete_id: string;
  starts_on: string;
  ends_on: string;
};

export const EMPTY_PLAN_FORM: PlanFormState = {
  title: "",
  description: "",
  is_template: true,
  athlete_id: "",
  starts_on: "",
  ends_on: "",
};

export function validatePlanForm(s: PlanFormState): string | null {
  const title = s.title.trim();
  if (!title) return "Titel ist Pflicht.";
  if (title.length > 120) return "Titel darf maximal 120 Zeichen haben.";
  if (s.description.length > 2000) return "Beschreibung darf maximal 2000 Zeichen haben.";
  if (!s.is_template && !s.athlete_id)
    return "Zugewiesener Athlet ist Pflicht (oder als Template speichern).";
  if (s.starts_on && s.ends_on && s.ends_on < s.starts_on)
    return "Ende darf nicht vor Start liegen.";
  return null;
}

export function planFormToInput(s: PlanFormState): PlanInput {
  return {
    title: s.title.trim(),
    description: s.description.trim() ? s.description.trim() : null,
    is_template: s.is_template,
    athlete_id: s.is_template ? null : s.athlete_id || null,
    starts_on: s.starts_on || null,
    ends_on: s.ends_on || null,
  };
}
