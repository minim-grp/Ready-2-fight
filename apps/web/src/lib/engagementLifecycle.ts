export type EngagementStatus = "pending" | "active" | "paused" | "ended";

export type EngagementPurpose =
  | "general"
  | "competition_prep"
  | "technique"
  | "strength_cond"
  | "nutrition"
  | "rehab";

export type EngagementEndReason = "completed" | "athlete_left" | "coach_ended" | "mutual";

export function statusLabel(s: EngagementStatus): string {
  switch (s) {
    case "pending":
      return "wartet";
    case "active":
      return "aktiv";
    case "paused":
      return "pausiert";
    case "ended":
      return "beendet";
  }
}

const STATUS_STYLES: Record<EngagementStatus, string> = {
  pending: "border-slate-700 text-slate-400",
  active: "border-emerald-700 text-emerald-300",
  paused: "border-amber-700 text-amber-300",
  ended: "border-slate-700 text-slate-500",
};

export function statusStyle(s: EngagementStatus): string {
  return STATUS_STYLES[s];
}

export function purposeLabel(p: string): string {
  switch (p) {
    case "general":
      return "Allgemein";
    case "competition_prep":
      return "Wettkampfvorbereitung";
    case "technique":
      return "Technik";
    case "strength_cond":
      return "Kraft & Kondition";
    case "nutrition":
      return "Ernaehrung";
    case "rehab":
      return "Reha";
    default:
      return p;
  }
}

export function endReasonLabel(r: string | null): string | null {
  if (!r) return null;
  switch (r) {
    case "completed":
      return "Erfolgreich abgeschlossen";
    case "athlete_left":
      return "Athlet hat beendet";
    case "coach_ended":
      return "Coach hat beendet";
    case "mutual":
      return "Einvernehmlich beendet";
    default:
      return r;
  }
}

export function mapLifecycleError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("not_authenticated")) {
    return "Sitzung abgelaufen — bitte neu anmelden.";
  }
  if (raw.includes("engagement_not_found")) {
    return "Engagement nicht gefunden.";
  }
  if (raw.includes("engagement_not_active")) {
    return "Nur aktive Engagements koennen pausiert werden.";
  }
  if (raw.includes("engagement_not_paused")) {
    return "Engagement ist nicht pausiert.";
  }
  if (raw.includes("engagement_already_ended")) {
    return "Engagement wurde bereits beendet.";
  }
  if (raw.includes("invalid_end_reason")) {
    return "Ungueltiger End-Grund.";
  }
  return "Aktion fehlgeschlagen — bitte erneut versuchen.";
}
