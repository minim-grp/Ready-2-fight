// Edge Function: send-notifications (Roadmap §1.31)
//
// Cron-getrieben. Drei Notification-Typen:
//   - tracking_reminder  (taeglich)
//   - chat_digest        (taeglich abends)
//   - plan_assigned      (kann auch on-INSERT-Trigger als Webhook,
//                         im MVP einfach via Cron seit last_run_at)
//
// POST /send-notifications  body: { kinds?: NotificationKind[], dry_run?: boolean }
//   kinds: optional, default = alle drei
//   dry_run: wenn true, werden Candidates ermittelt aber nicht versendet
//
// Auth: Service-Role (Cron). Kein User-JWT — die Funktion laeuft mit
// SERVICE_ROLE_KEY und liest *alle* Tracking-States ein. RLS wird
// also umgangen, das ist fuer einen Notification-Cron erwartetes
// Verhalten (CLAUDE.md §1, "Cron-Jobs" als Edge-Function-Anwendungsfall).
//
// Authorisierung: Header `x-cron-secret` muss mit env CRON_SECRET
// matchen. Cron-Konfiguration legt diesen Header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  selectChatDigests,
  selectPlanAssignedNotices,
  selectTrackingReminders,
  type AthleteTrackingState,
  type ChatUnreadState,
  type NotificationCandidate,
  type NotificationKind,
  type PlanAssignedRow,
} from "../_shared/notifications/selectors.ts";
import { renderEmail } from "../_shared/notifications/templates.ts";
import {
  createMockSender,
  createResendSender,
  type EmailSender,
  type EmailSendResult,
} from "../_shared/notifications/email.ts";

type Body = { kinds?: NotificationKind[]; dry_run?: boolean };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.ready2fight.example";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Ready 2 Fight <noreply@ready2fight.app>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const ALL_KINDS: NotificationKind[] = [
  "tracking_reminder",
  "chat_digest",
  "plan_assigned",
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  const cronHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: Body;
  try {
    body = (await req.json().catch(() => ({}))) as Body;
  } catch {
    body = {};
  }
  const kinds: NotificationKind[] = body.kinds ?? ALL_KINDS;
  const dryRun = body.dry_run === true;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const sender: EmailSender = RESEND_API_KEY
    ? createResendSender({ apiKey: RESEND_API_KEY, fromAddress: RESEND_FROM })
    : createMockSender();

  const candidates: NotificationCandidate[] = [];
  const now = new Date();

  if (kinds.includes("tracking_reminder")) {
    const states = await loadTrackingStates(admin);
    candidates.push(...selectTrackingReminders(states, now));
  }
  if (kinds.includes("chat_digest")) {
    const states = await loadChatUnreadStates(admin);
    candidates.push(...selectChatDigests(states, now));
  }
  if (kinds.includes("plan_assigned")) {
    const rows = await loadPlanAssignedRows(admin);
    candidates.push(...selectPlanAssignedNotices(rows));
  }

  if (dryRun) {
    return jsonResponse({
      dry_run: true,
      candidate_count: candidates.length,
      kinds: candidates.map((c) => c.kind),
    });
  }

  const results: Array<{
    kind: NotificationKind;
    user_id: string;
    result: EmailSendResult;
  }> = [];
  for (const c of candidates) {
    const email = renderEmail({ candidate: c, appUrl: APP_URL });
    const result = await sender.send({ to: c.email, email });
    results.push({ kind: c.kind, user_id: c.user_id, result });
  }

  const sent = results.filter((r) => r.result.ok).length;
  const failed = results.length - sent;
  return jsonResponse({
    sent,
    failed,
    candidate_count: candidates.length,
    failures: results.filter((r) => !r.result.ok),
  });
});

// ============================================================
// DB-Loader. Bewusst defensiv: bei DB-Fehler Empty-Array statt
// Throw, damit ein einzelnes Probleme nicht den ganzen Cron-Run
// killt (Tracking-Reminder + Chat-Digest sind unabhaengig).
// ============================================================

type AdminClient = ReturnType<typeof createClient>;

async function loadTrackingStates(c: AdminClient): Promise<AthleteTrackingState[]> {
  // Aktive Engagements → distinct athlete_ids → letzter daily_tracking-Eintrag.
  const { data: engRows, error: engErr } = await c
    .from("coach_athlete_engagements")
    .select("athlete_id")
    .eq("status", "active");
  if (engErr || !engRows) return [];
  const athleteIds = Array.from(new Set(engRows.map((r) => r.athlete_id as string)));
  if (athleteIds.length === 0) return [];

  const { data: userRows, error: userErr } = await c
    .from("users")
    .select("id, email, display_name")
    .in("id", athleteIds);
  if (userErr || !userRows) return [];

  const { data: trackRows, error: trackErr } = await c
    .from("daily_tracking")
    .select("athlete_id, date")
    .in("athlete_id", athleteIds)
    .order("date", { ascending: false });
  if (trackErr) return [];

  const lastByAthlete = new Map<string, string>();
  for (const r of trackRows ?? []) {
    const aid = r.athlete_id as string;
    if (!lastByAthlete.has(aid)) lastByAthlete.set(aid, r.date as string);
  }

  return (
    userRows as Array<{ id: string; email: string | null; display_name: string | null }>
  )
    .filter((u) => u.email !== null)
    .map((u) => ({
      user_id: u.id,
      email: u.email!,
      display_name: u.display_name,
      has_active_engagement: true,
      last_tracked_date: lastByAthlete.get(u.id) ?? null,
    }));
}

async function loadChatUnreadStates(c: AdminClient): Promise<ChatUnreadState[]> {
  // Vereinfachte Implementierung: aggregiere chat_messages pro Empfaenger.
  // Empfaenger = der NICHT-Sender im Engagement.
  const { data: msgRows, error: msgErr } = await c
    .from("chat_messages")
    .select("channel_id, sender_id, created_at, read_at")
    .is("read_at", null);
  if (msgErr || !msgRows) return [];
  if (msgRows.length === 0) return [];

  const channelIds = Array.from(new Set(msgRows.map((m) => m.channel_id as string)));
  const { data: chRows, error: chErr } = await c
    .from("chat_channels")
    .select("id, engagement_id")
    .in("id", channelIds);
  if (chErr || !chRows) return [];

  const engagementByChannel = new Map(
    chRows.map((ch) => [ch.id as string, ch.engagement_id as string]),
  );
  const engagementIds = Array.from(
    new Set(chRows.map((ch) => ch.engagement_id as string)),
  );

  const { data: engRows, error: engErr } = await c
    .from("coach_athlete_engagements")
    .select("id, coach_id, athlete_id, status")
    .in("id", engagementIds);
  if (engErr || !engRows) return [];
  const engById = new Map(engRows.map((e) => [e.id as string, e]));

  // Pro (channel, recipient) zaehlen
  type Aggr = { count: number; oldest: string };
  const perRecipient = new Map<string, Aggr>(); // key = `${userId}|${channelId}`
  for (const m of msgRows) {
    const ch = engagementByChannel.get(m.channel_id as string);
    if (!ch) continue;
    const eng = engById.get(ch);
    if (!eng || eng.status !== "active") continue;
    const recipient =
      (m.sender_id as string) === eng.coach_id ? eng.athlete_id : eng.coach_id;
    const key = `${recipient as string}|${m.channel_id as string}`;
    const cur = perRecipient.get(key);
    if (cur) {
      cur.count += 1;
      if ((m.created_at as string) < cur.oldest) cur.oldest = m.created_at as string;
    } else {
      perRecipient.set(key, { count: 1, oldest: m.created_at as string });
    }
  }

  // Aggregiere pro user (eine Mail pro User, nicht pro Channel)
  type UserAggr = {
    count: number;
    oldest: string;
    counterparty_user_id: string | null;
  };
  const perUser = new Map<string, UserAggr>();
  for (const [key, aggr] of perRecipient.entries()) {
    const [userId, channelId] = key.split("|");
    if (!userId || !channelId) continue;
    const eng = engById.get(engagementByChannel.get(channelId)!);
    if (!eng) continue;
    const counterpartyId =
      userId === eng.coach_id ? (eng.athlete_id as string) : (eng.coach_id as string);
    const cur = perUser.get(userId);
    if (cur) {
      cur.count += aggr.count;
      if (aggr.oldest < cur.oldest) cur.oldest = aggr.oldest;
    } else {
      perUser.set(userId, {
        count: aggr.count,
        oldest: aggr.oldest,
        counterparty_user_id: counterpartyId,
      });
    }
  }

  if (perUser.size === 0) return [];
  const allUserIds = Array.from(
    new Set(
      Array.from(perUser.entries()).flatMap(([uid, a]) =>
        a.counterparty_user_id ? [uid, a.counterparty_user_id] : [uid],
      ),
    ),
  );
  const { data: userRows, error: userErr } = await c
    .from("users")
    .select("id, email, display_name")
    .in("id", allUserIds);
  if (userErr || !userRows) return [];
  const userById = new Map(
    (
      userRows as Array<{ id: string; email: string | null; display_name: string | null }>
    ).map((u) => [u.id, u]),
  );

  const out: ChatUnreadState[] = [];
  for (const [userId, aggr] of perUser.entries()) {
    const u = userById.get(userId);
    if (!u || !u.email) continue;
    const cp = aggr.counterparty_user_id ? userById.get(aggr.counterparty_user_id) : null;
    out.push({
      user_id: userId,
      email: u.email,
      display_name: u.display_name,
      unread_count: aggr.count,
      oldest_unread_at: aggr.oldest,
      counterparty_name: cp?.display_name ?? null,
    });
  }
  return out;
}

async function loadPlanAssignedRows(c: AdminClient): Promise<PlanAssignedRow[]> {
  // Fenster: Plaene, die in den letzten 24 h zugewiesen wurden
  // (= cron-Lauf taeglich). Idempotenz im MVP: doppelte Mails nehmen
  // wir in Kauf, alternativ ein notifications.last_sent_at-Tracker.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: planRows, error: planErr } = await c
    .from("training_plans")
    .select("id, title, owner_id, athlete_id, created_at")
    .not("athlete_id", "is", null)
    .eq("is_template", false)
    .gte("created_at", since);
  if (planErr || !planRows) return [];
  if (planRows.length === 0) return [];

  const userIds = Array.from(
    new Set(planRows.flatMap((p) => [p.owner_id as string, p.athlete_id as string])),
  );
  const { data: userRows, error: userErr } = await c
    .from("users")
    .select("id, email, display_name")
    .in("id", userIds);
  if (userErr || !userRows) return [];
  const userById = new Map(
    (
      userRows as Array<{ id: string; email: string | null; display_name: string | null }>
    ).map((u) => [u.id, u]),
  );

  return planRows
    .map((p): PlanAssignedRow | null => {
      const athlete = userById.get(p.athlete_id as string);
      const coach = userById.get(p.owner_id as string);
      if (!athlete || !athlete.email) return null;
      return {
        plan_id: p.id as string,
        plan_title: p.title as string,
        athlete_user_id: athlete.id,
        athlete_email: athlete.email,
        athlete_display_name: athlete.display_name,
        coach_display_name: coach?.display_name ?? null,
      };
    })
    .filter((r): r is PlanAssignedRow => r !== null);
}
