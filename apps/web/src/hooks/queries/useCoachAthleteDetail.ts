import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

// ============================================================
// Coach-Sicht auf einen einzelnen Athleten — alle drei
// permission-gated Read-Hooks landen hier, weil sie zusammen
// auf `/app/athletes/:athleteId` konsumiert werden und
// dieselbe RLS-Logik teilen (`is_linked_coach_with_*`-Helper).
// ============================================================

const TRACKING_HISTORY_DAYS = 30;

export type AthleteTrackingDay = {
  date: string;
  trained: boolean;
  rpe: number | null;
  weight_kg: number | null;
  mood: string | null;
};

// daily_tracking unterliegt RLS dt_coach_read mit
// `is_linked_coach_with_tracking`. Coach ohne Permission bekommt 0 Rows.
export function useCoachAthleteTrackingHistory(athleteId: string | undefined) {
  return useQuery({
    enabled: !!athleteId,
    queryKey: ["coach-athlete", athleteId, "tracking-history"],
    queryFn: async (): Promise<AthleteTrackingDay[]> => {
      const fromIso = new Date(Date.now() - TRACKING_HISTORY_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("daily_tracking")
        .select("date, trained, rpe, weight_kg, mood")
        .eq("athlete_id", athleteId!)
        .gte("date", fromIso)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AthleteTrackingDay[];
    },
  });
}

export type AthleteCrsScore = {
  test_id: string;
  score: number;
  rank: string | null;
  completed_at: string;
};

// crs_tests unterliegt RLS mit `is_linked_coach_with_tests`.
export function useCoachAthleteCrsHistory(athleteId: string | undefined) {
  return useQuery({
    enabled: !!athleteId,
    queryKey: ["coach-athlete", athleteId, "crs-history"],
    queryFn: async (): Promise<AthleteCrsScore[]> => {
      const { data, error } = await supabase
        .from("crs_tests")
        .select("id, score, rank_label, completed_at")
        .eq("athlete_id", athleteId!)
        .eq("status", "completed")
        .not("score", "is", null)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter(
          (
            r,
          ): r is {
            id: string;
            score: number;
            rank_label: string | null;
            completed_at: string;
          } => r.score != null && r.completed_at != null,
        )
        .map((r) => ({
          test_id: r.id,
          score: r.score,
          rank: r.rank_label,
          completed_at: r.completed_at,
        }));
    },
  });
}

export type AthleteAssignedPlan = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  archived_at: string | null;
  created_at: string;
};

// training_plans unterliegt tp_owner_all (owner_id=auth.uid()).
// Hier filtern wir zusaetzlich auf athlete_id, um nur die Plaene
// dieses Coaches fuer diesen Athleten zu sehen.
export function useCoachAthletePlans(athleteId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!athleteId && !!userId,
    queryKey: ["coach-athlete", athleteId, "plans", userId],
    queryFn: async (): Promise<AthleteAssignedPlan[]> => {
      const { data, error } = await supabase
        .from("training_plans")
        .select("id, title, description, starts_on, ends_on, archived_at, created_at")
        .eq("owner_id", userId!)
        .eq("athlete_id", athleteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AthleteAssignedPlan[];
    },
  });
}
