import type { CompetitionInput } from "../../hooks/queries/useCompetitions";

export type CompetitionFormState = {
  title: string;
  competition_date: string;
  discipline: string;
  weight_class: string;
  location: string;
  result: string;
  notes: string;
};

export const EMPTY_COMPETITION_FORM: CompetitionFormState = {
  title: "",
  competition_date: "",
  discipline: "",
  weight_class: "",
  location: "",
  result: "",
  notes: "",
};

const MAX_TITLE = 120;
const MAX_TEXT = 200;
const MAX_NOTES = 2000;

export function validateCompetitionForm(s: CompetitionFormState): string | null {
  const title = s.title.trim();
  if (!title) return "Titel ist Pflicht.";
  if (title.length > MAX_TITLE) return `Titel darf maximal ${MAX_TITLE} Zeichen haben.`;
  if (!s.competition_date) return "Datum ist Pflicht.";
  if (s.discipline.length > MAX_TEXT)
    return `Disziplin darf maximal ${MAX_TEXT} Zeichen haben.`;
  if (s.weight_class.length > MAX_TEXT)
    return `Gewichtsklasse darf maximal ${MAX_TEXT} Zeichen haben.`;
  if (s.location.length > MAX_TEXT) return `Ort darf maximal ${MAX_TEXT} Zeichen haben.`;
  if (s.result.length > MAX_TEXT)
    return `Ergebnis darf maximal ${MAX_TEXT} Zeichen haben.`;
  if (s.notes.length > MAX_NOTES)
    return `Notizen duerfen maximal ${MAX_NOTES} Zeichen haben.`;
  return null;
}

function nullIfEmpty(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

export function competitionFormToInput(s: CompetitionFormState): CompetitionInput {
  return {
    title: s.title.trim(),
    competition_date: s.competition_date,
    discipline: nullIfEmpty(s.discipline),
    weight_class: nullIfEmpty(s.weight_class),
    location: nullIfEmpty(s.location),
    result: nullIfEmpty(s.result),
    notes: nullIfEmpty(s.notes),
  };
}

export function hydrateCompetitionForm(
  c: {
    title: string;
    competition_date: string;
    discipline: string | null;
    weight_class: string | null;
    location: string | null;
    result: string | null;
    notes: string | null;
  } | null,
): CompetitionFormState {
  if (!c) return EMPTY_COMPETITION_FORM;
  return {
    title: c.title,
    competition_date: c.competition_date,
    discipline: c.discipline ?? "",
    weight_class: c.weight_class ?? "",
    location: c.location ?? "",
    result: c.result ?? "",
    notes: c.notes ?? "",
  };
}
