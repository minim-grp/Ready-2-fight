import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type AthletePlan = {
  id: string;
  owner_id: string;
  athlete_id: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  coach_name: string | null;
};

type RawPlanRow = {
  id: string;
  owner_id: string;
  athlete_id: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  coach: { display_name: string | null } | null;
};

export type AthletePlanSession = {
  id: string;
  plan_id: string;
  day_offset: number;
  title: string;
  notes: string | null;
  position: number;
};

export type AthletePlanExercise = {
  id: string;
  session_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
  position: number;
};

export type AthletePlanWithSessions = AthletePlan & {
  sessions: AthletePlanSession[];
};

// Liste aller dem Athleten zugewiesenen, nicht archivierten Plaene.
// RLS tp_athlete_read filtert auf athlete_id = auth.uid() (athlete_profiles.id == users.id).
export function useAthletePlans() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!userId,
    queryKey: ["athlete-plans", userId],
    queryFn: async (): Promise<AthletePlan[]> => {
      const { data, error } = await supabase
        .from("training_plans")
        .select(
          `id, owner_id, athlete_id, title, description, starts_on, ends_on,
           archived_at, created_at, updated_at,
           coach:users!owner_id(display_name)`,
        )
        .eq("athlete_id", userId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawPlanRow[]).map<AthletePlan>((r) => ({
        id: r.id,
        owner_id: r.owner_id,
        athlete_id: r.athlete_id,
        title: r.title,
        description: r.description,
        starts_on: r.starts_on,
        ends_on: r.ends_on,
        archived_at: r.archived_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        coach_name: r.coach?.display_name ?? null,
      }));
    },
  });
}

export function useAthletePlan(planId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!planId && !!userId,
    queryKey: ["athlete-plans", userId, "detail", planId],
    queryFn: async (): Promise<AthletePlanWithSessions | null> => {
      const { data: planRow, error: planErr } = await supabase
        .from("training_plans")
        .select(
          `id, owner_id, athlete_id, title, description, starts_on, ends_on,
           archived_at, created_at, updated_at,
           coach:users!owner_id(display_name)`,
        )
        .eq("id", planId!)
        .eq("athlete_id", userId!)
        .maybeSingle();
      if (planErr) throw planErr;
      if (!planRow) return null;

      const { data: sessionRows, error: sessionErr } = await supabase
        .from("training_sessions")
        .select("id, plan_id, day_offset, title, notes, position")
        .eq("plan_id", planId!)
        .order("position", { ascending: true })
        .order("day_offset", { ascending: true });
      if (sessionErr) throw sessionErr;

      const raw = planRow as unknown as RawPlanRow;
      return {
        id: raw.id,
        owner_id: raw.owner_id,
        athlete_id: raw.athlete_id,
        title: raw.title,
        description: raw.description,
        starts_on: raw.starts_on,
        ends_on: raw.ends_on,
        archived_at: raw.archived_at,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        coach_name: raw.coach?.display_name ?? null,
        sessions: (sessionRows ?? []) as AthletePlanSession[],
      };
    },
  });
}

export function useAthleteSessionExercises(sessionId: string | undefined) {
  return useQuery({
    enabled: !!sessionId,
    queryKey: ["athlete-plans", "session", sessionId, "exercises"],
    queryFn: async (): Promise<AthletePlanExercise[]> => {
      const { data, error } = await supabase
        .from("training_exercises")
        .select(
          "id, session_id, name, sets, reps, weight_kg, duration_sec, rest_sec, notes, position",
        )
        .eq("session_id", sessionId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AthletePlanExercise[];
    },
  });
}

export type SessionCompletion = {
  id: string;
  session_id: string;
  athlete_id: string;
  completed_at: string | null;
};

// Liest Completions fuer einen Plan in einem Query (alle Sessions-IDs des Plans).
// Nutzt RLS "Athletes manage own completions" → eq(athlete_id, userId) ist redundant
// bleibt aber als Defense-in-Depth.
export function usePlanCompletions(planId: string | undefined, sessionIds: string[]) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!planId && !!userId && sessionIds.length > 0,
    queryKey: ["athlete-plans", userId, "completions", planId],
    queryFn: async (): Promise<SessionCompletion[]> => {
      const { data, error } = await supabase
        .from("session_completions")
        .select("id, session_id, athlete_id, completed_at")
        .eq("athlete_id", userId!)
        .in("session_id", sessionIds);
      if (error) throw error;
      return (data ?? []) as SessionCompletion[];
    },
  });
}

// Toggelt Completion: bei completion-id loescht, sonst inserted.
// Trigger on_session_completion_grant_xp vergibt 30 XP nach INSERT (PR #49).
export function useToggleSessionCompletion(planId: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      completion_id: string | null;
    }): Promise<void> => {
      if (!userId) throw new Error("not_authenticated");
      if (input.completion_id) {
        const { error } = await supabase
          .from("session_completions")
          .delete()
          .eq("id", input.completion_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("session_completions").insert({
          session_id: input.session_id,
          athlete_id: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["athlete-plans", userId, "completions", planId],
      });
      // XP-Trigger #49 vergibt XP, Streak-Logik liest tracked_at — Streak-Karte refreshen.
      void qc.invalidateQueries({ queryKey: ["streaks", userId] });
    },
  });
}
