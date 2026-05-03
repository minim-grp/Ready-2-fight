// Reine Selektor-Logik fuer §1.31 Notification-Trigger.
// Vitest-friendly: keine Deno-Globals, keine externen Imports.
//
// Die Funktionen nehmen rohe DB-Rows und produzieren eine Liste von
// NotificationCandidates — Empfaenger + Kontextdaten fuer das Template.
// Der eigentliche Versand ist in der Edge Function.

export type NotificationKind = "tracking_reminder" | "chat_digest" | "plan_assigned";

export type NotificationCandidate = {
  kind: NotificationKind;
  user_id: string;
  email: string;
  display_name: string | null;
  // pro Kind unterschiedliche Detail-Daten:
  detail: Record<string, unknown>;
};

// ============================================================
// 1. tracking_reminder: Athleten mit aktivem Engagement (egal ob Coach
//    can_see_tracking hat) und letzter daily_tracking-Eintrag
//    > N Tagen her oder noch nie. Einmal pro Tag durch Cron.
// ============================================================

export type AthleteTrackingState = {
  user_id: string;
  email: string;
  display_name: string | null;
  has_active_engagement: boolean;
  last_tracked_date: string | null;
};

const REMINDER_THRESHOLD_DAYS = 3;

export function selectTrackingReminders(
  rows: AthleteTrackingState[],
  today: Date,
): NotificationCandidate[] {
  const cutoffIso = isoDaysFromNow(-REMINDER_THRESHOLD_DAYS, today);
  return rows
    .filter((r) => r.has_active_engagement)
    .filter((r) => r.last_tracked_date === null || r.last_tracked_date < cutoffIso)
    .map((r) => ({
      kind: "tracking_reminder" as const,
      user_id: r.user_id,
      email: r.email,
      display_name: r.display_name,
      detail: {
        last_tracked_date: r.last_tracked_date,
        threshold_days: REMINDER_THRESHOLD_DAYS,
      },
    }));
}

// ============================================================
// 2. chat_digest: User mit ungelesenen Messages aelter als N Stunden
//    (Athlet ODER Coach). Ein Eintrag pro User mit Anzahl + Counterparty.
//    Cron z.B. taeglich abends.
// ============================================================

export type ChatUnreadState = {
  user_id: string;
  email: string;
  display_name: string | null;
  unread_count: number;
  oldest_unread_at: string;
  counterparty_name: string | null;
};

const DIGEST_MIN_AGE_HOURS = 6;

export function selectChatDigests(
  rows: ChatUnreadState[],
  now: Date,
): NotificationCandidate[] {
  const cutoffMs = now.getTime() - DIGEST_MIN_AGE_HOURS * 60 * 60 * 1000;
  return rows
    .filter((r) => r.unread_count > 0)
    .filter((r) => new Date(r.oldest_unread_at).getTime() <= cutoffMs)
    .map((r) => ({
      kind: "chat_digest" as const,
      user_id: r.user_id,
      email: r.email,
      display_name: r.display_name,
      detail: {
        unread_count: r.unread_count,
        counterparty_name: r.counterparty_name,
      },
    }));
}

// ============================================================
// 3. plan_assigned: Wird beim Insert eines training_plans mit
//    athlete_id NOT NULL ausgeloest. Hier Pure-Selektor: nimmt
//    eine Liste frisch zugewiesener Plaene und produziert
//    Empfaenger-Daten. Edge Function ruft das pro neuem Plan
//    (oder per Cron alle Plaene seit Last-Run).
// ============================================================

export type PlanAssignedRow = {
  plan_id: string;
  plan_title: string;
  athlete_user_id: string;
  athlete_email: string;
  athlete_display_name: string | null;
  coach_display_name: string | null;
};

export function selectPlanAssignedNotices(
  rows: PlanAssignedRow[],
): NotificationCandidate[] {
  return rows.map((r) => ({
    kind: "plan_assigned" as const,
    user_id: r.athlete_user_id,
    email: r.athlete_email,
    display_name: r.athlete_display_name,
    detail: {
      plan_id: r.plan_id,
      plan_title: r.plan_title,
      coach_display_name: r.coach_display_name,
    },
  }));
}

// ============================================================
// Helpers (lokal, kein Import → kein Deno/Browser-Globals).
// ============================================================

function isoDaysFromNow(days: number, today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
