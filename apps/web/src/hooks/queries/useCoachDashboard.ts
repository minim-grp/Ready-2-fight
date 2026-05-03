import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

const WEEK_DAYS = 7;
const TRACKING_OVERDUE_DAYS = 3;
const UPCOMING_COMPETITION_DAYS = 14;

export type CoachWeekEvent = {
  date: string;
  type: "session" | "competition";
  athlete_id: string;
  athlete_name: string;
  title: string;
  plan_id: string | null;
};

function todayIso(today: Date = new Date()): string {
  return today.toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number, today: Date = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type RawPlan = {
  id: string;
  athlete_id: string;
  starts_on: string | null;
  ends_on: string | null;
  athlete: { display_name: string | null } | null;
};

type RawSession = {
  id: string;
  plan_id: string;
  day_offset: number;
  title: string;
};

type RawCompetition = {
  id: string;
  athlete_id: string;
  competition_date: string;
  title: string;
  athlete: { display_name: string | null } | null;
};

// Wochenkalender: alle Sessions + Wettkaempfe der naechsten 7 Tage
// fuer alle Athleten dieses Coaches. Sessions ohne plan.starts_on
// haben keinen Kalender-Termin und werden ausgeblendet.
export function useCoachWeekEvents(today: Date = new Date()) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!userId,
    queryKey: ["coach-dashboard", userId, "week-events", todayIso(today)],
    queryFn: async (): Promise<CoachWeekEvent[]> => {
      const fromIso = todayIso(today);
      const toIso = isoDaysFromNow(WEEK_DAYS, today);

      // 1) aktive zugewiesene Plaene mit starts_on
      const { data: plansRaw, error: plansErr } = await supabase
        .from("training_plans")
        .select(
          `id, athlete_id, starts_on, ends_on,
           athlete:users!athlete_id(display_name)`,
        )
        .eq("owner_id", userId!)
        .not("athlete_id", "is", null)
        .is("archived_at", null)
        .not("starts_on", "is", null);
      if (plansErr) throw plansErr;
      const plans = (plansRaw ?? []) as unknown as RawPlan[];

      // 2) Sessions zu allen diesen Plaenen
      const planIds = plans.map((p) => p.id);
      const sessions = planIds.length
        ? await (async (): Promise<RawSession[]> => {
            const { data, error } = await supabase
              .from("training_sessions")
              .select("id, plan_id, day_offset, title")
              .in("plan_id", planIds);
            if (error) throw error;
            return (data ?? []) as RawSession[];
          })()
        : [];

      // 3) Sessions auf Kalender-Daten projizieren + auf Fenster filtern
      const planById = new Map(plans.map((p) => [p.id, p]));
      const sessionEvents: CoachWeekEvent[] = sessions
        .map((s): CoachWeekEvent | null => {
          const plan = planById.get(s.plan_id);
          if (!plan?.starts_on) return null;
          const date = addDays(plan.starts_on, s.day_offset);
          if (date < fromIso || date > toIso) return null;
          if (plan.ends_on && date > plan.ends_on) return null;
          return {
            date,
            type: "session",
            athlete_id: plan.athlete_id,
            athlete_name: plan.athlete?.display_name ?? "Athlet",
            title: s.title,
            plan_id: plan.id,
          };
        })
        .filter((e): e is CoachWeekEvent => e !== null);

      // 4) Wettkaempfe (RLS comp_coach_read mit can_see_tracking;
      //    Wettkaempfe ohne Permission liefern einfach 0 Rows).
      const { data: compsRaw, error: compsErr } = await supabase
        .from("competitions")
        .select(
          `id, athlete_id, competition_date, title,
           athlete:users!athlete_id(display_name)`,
        )
        .gte("competition_date", fromIso)
        .lte("competition_date", toIso);
      if (compsErr) throw compsErr;
      const competitionEvents: CoachWeekEvent[] = (
        (compsRaw ?? []) as unknown as RawCompetition[]
      ).map((c) => ({
        date: c.competition_date,
        type: "competition" as const,
        athlete_id: c.athlete_id,
        athlete_name: c.athlete?.display_name ?? "Athlet",
        title: c.title,
        plan_id: null,
      }));

      return [...sessionEvents, ...competitionEvents].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
      );
    },
  });
}

export type AttentionRule = "tracking_overdue" | "upcoming_competition";

export type CoachAttentionItem = {
  athlete_id: string;
  athlete_name: string;
  rule: AttentionRule;
  detail: string;
};

// Aufmerksamkeitsliste: regelbasiert (NICHT KI per CLAUDE.md §0.3).
// - tracking_overdue: letztes daily_tracking > 3 Tage her (nur fuer
//   Athleten mit can_see_tracking-Permission, sonst sieht der Coach
//   die Tracking-Tabelle ohnehin nicht und der RLS-Filter killt die
//   Rule-Detection).
// - upcoming_competition: Wettkampf in den naechsten 14 Tagen
//   (RLS comp_coach_read mit can_see_tracking).
export function useCoachAttentionItems(today: Date = new Date()) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!userId,
    queryKey: ["coach-dashboard", userId, "attention", todayIso(today)],
    queryFn: async (): Promise<CoachAttentionItem[]> => {
      const fromIso = todayIso(today);
      const compToIso = isoDaysFromNow(UPCOMING_COMPETITION_DAYS, today);
      const overdueCutoff = isoDaysFromNow(-TRACKING_OVERDUE_DAYS, today);

      // 1) Aktive Engagements dieses Coaches inkl. Athleten + Permissions
      const { data: engRaw, error: engErr } = await supabase
        .from("coach_athlete_engagements")
        .select(
          `id, athlete_id, can_see_tracking,
           athlete:users!athlete_id(display_name)`,
        )
        .eq("coach_id", userId!)
        .eq("status", "active");
      if (engErr) throw engErr;
      type EngRow = {
        id: string;
        athlete_id: string;
        can_see_tracking: boolean | null;
        athlete: { display_name: string | null } | null;
      };
      const engagements = (engRaw ?? []) as unknown as EngRow[];
      const trackedAthleteIds = engagements
        .filter((e) => e.can_see_tracking === true)
        .map((e) => e.athlete_id);
      const nameById = new Map(
        engagements.map((e) => [e.athlete_id, e.athlete?.display_name ?? "Athlet"]),
      );

      // 2) tracking_overdue: max(date) pro athlete, alle die juengsten
      //    tracking-Eintraege < cutoff sind ueberfaellig.
      const overdueItems: CoachAttentionItem[] = [];
      if (trackedAthleteIds.length > 0) {
        const { data: tracksRaw, error: tracksErr } = await supabase
          .from("daily_tracking")
          .select("athlete_id, date")
          .in("athlete_id", trackedAthleteIds)
          .order("date", { ascending: false });
        if (tracksErr) throw tracksErr;
        type TrackRow = { athlete_id: string; date: string };
        const lastByAthlete = new Map<string, string>();
        for (const t of (tracksRaw ?? []) as TrackRow[]) {
          if (!lastByAthlete.has(t.athlete_id)) {
            lastByAthlete.set(t.athlete_id, t.date);
          }
        }
        for (const aid of trackedAthleteIds) {
          const last = lastByAthlete.get(aid) ?? null;
          if (last === null || last < overdueCutoff) {
            overdueItems.push({
              athlete_id: aid,
              athlete_name: nameById.get(aid) ?? "Athlet",
              rule: "tracking_overdue",
              detail: last ? `Letztes Tracking: ${last}` : "Noch nie getrackt",
            });
          }
        }
      }

      // 3) upcoming_competition: naechste 14 Tage
      const { data: compsRaw, error: compsErr } = await supabase
        .from("competitions")
        .select("id, athlete_id, competition_date, title")
        .gte("competition_date", fromIso)
        .lte("competition_date", compToIso)
        .order("competition_date", { ascending: true });
      if (compsErr) throw compsErr;
      type CompRow = {
        id: string;
        athlete_id: string;
        competition_date: string;
        title: string;
      };
      const compItems: CoachAttentionItem[] = ((compsRaw ?? []) as CompRow[]).map(
        (c) => ({
          athlete_id: c.athlete_id,
          athlete_name: nameById.get(c.athlete_id) ?? "Athlet",
          rule: "upcoming_competition",
          detail: `${c.title} am ${c.competition_date}`,
        }),
      );

      return [...overdueItems, ...compItems];
    },
  });
}
