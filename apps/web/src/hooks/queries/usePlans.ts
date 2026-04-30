import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type CoachPlan = {
  id: string;
  owner_id: string;
  athlete_id: string | null;
  athlete_name: string | null;
  title: string;
  description: string | null;
  is_template: boolean;
  archived_at: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
};

type RawPlanRow = {
  id: string;
  owner_id: string;
  athlete_id: string | null;
  title: string;
  description: string | null;
  is_template: boolean;
  archived_at: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
  athlete: { display_name: string | null } | null;
};

export type PlanInput = {
  title: string;
  description: string | null;
  is_template: boolean;
  athlete_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

export function useCoachPlans() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["plans", "coach", userId],
    queryFn: async (): Promise<CoachPlan[]> => {
      const { data, error } = await supabase
        .from("training_plans")
        .select(
          `id, owner_id, athlete_id, title, description, is_template,
           archived_at, starts_on, ends_on, created_at, updated_at,
           athlete:users!athlete_id(display_name)`,
        )
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawPlanRow[]).map<CoachPlan>((r) => ({
        id: r.id,
        owner_id: r.owner_id,
        athlete_id: r.athlete_id,
        athlete_name: r.athlete?.display_name ?? null,
        title: r.title,
        description: r.description,
        is_template: r.is_template,
        archived_at: r.archived_at,
        starts_on: r.starts_on,
        ends_on: r.ends_on,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: PlanInput): Promise<string> => {
      if (!userId) throw new Error("not_authenticated");
      const { data, error } = await supabase
        .from("training_plans")
        .insert({
          owner_id: userId,
          title: input.title,
          description: input.description,
          is_template: input.is_template,
          athlete_id: input.athlete_id,
          starts_on: input.starts_on,
          ends_on: input.ends_on,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", "coach", userId] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (planId: string): Promise<void> => {
      const { error } = await supabase.from("training_plans").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", "coach", userId] });
    },
  });
}

export type PlanSession = {
  id: string;
  plan_id: string;
  day_offset: number;
  title: string;
  notes: string | null;
  position: number;
};

export type PlanExercise = {
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

export type PlanWithSessions = CoachPlan & { sessions: PlanSession[] };

export function usePlan(planId: string | undefined) {
  return useQuery({
    enabled: !!planId,
    queryKey: ["plans", "detail", planId],
    queryFn: async (): Promise<PlanWithSessions | null> => {
      const { data: planRow, error: planErr } = await supabase
        .from("training_plans")
        .select(
          `id, owner_id, athlete_id, title, description, is_template,
           archived_at, starts_on, ends_on, created_at, updated_at,
           athlete:users!athlete_id(display_name)`,
        )
        .eq("id", planId!)
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
        athlete_name: raw.athlete?.display_name ?? null,
        title: raw.title,
        description: raw.description,
        is_template: raw.is_template,
        archived_at: raw.archived_at,
        starts_on: raw.starts_on,
        ends_on: raw.ends_on,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        sessions: (sessionRows ?? []) as PlanSession[],
      };
    },
  });
}

export type CreateSessionInput = {
  plan_id: string;
  title: string;
  day_offset: number;
  notes: string | null;
  position: number;
};

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSessionInput): Promise<string> => {
      const { data, error } = await supabase
        .from("training_sessions")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ["plans", "detail", vars.plan_id] });
    },
  });
}

export type UpdateSessionInput = {
  id: string;
  plan_id: string;
  title?: string;
  notes?: string | null;
  day_offset?: number;
  position?: number;
};

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSessionInput): Promise<void> => {
      const { id, plan_id, ...patch } = input;
      void plan_id;
      const { error } = await supabase
        .from("training_sessions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: ["plans", "detail", vars.plan_id] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; plan_id: string }): Promise<void> => {
      const { error } = await supabase
        .from("training_sessions")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: ["plans", "detail", vars.plan_id] });
    },
  });
}

// Atomic Swap zweier Sessions: tauscht position der beiden Rows.
// Reihenfolge in der UI orientiert sich an position ASC (Tie-Break day_offset).
export function useSwapSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plan_id: string;
      a: PlanSession;
      b: PlanSession;
    }): Promise<void> => {
      const { error: errA } = await supabase
        .from("training_sessions")
        .update({ position: input.b.position })
        .eq("id", input.a.id);
      if (errA) throw errA;
      const { error: errB } = await supabase
        .from("training_sessions")
        .update({ position: input.a.position })
        .eq("id", input.b.id);
      if (errB) throw errB;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: ["plans", "detail", vars.plan_id] });
    },
  });
}

// ============================================================
// Exercises (training_exercises)
// ============================================================

export function useSessionExercises(sessionId: string | undefined) {
  return useQuery({
    enabled: !!sessionId,
    queryKey: ["plan-sessions", sessionId, "exercises"],
    queryFn: async (): Promise<PlanExercise[]> => {
      const { data, error } = await supabase
        .from("training_exercises")
        .select(
          "id, session_id, name, sets, reps, weight_kg, duration_sec, rest_sec, notes, position",
        )
        .eq("session_id", sessionId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanExercise[];
    },
  });
}

export type CreateExerciseInput = {
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

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExerciseInput): Promise<string> => {
      const { data, error } = await supabase
        .from("training_exercises")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({
        queryKey: ["plan-sessions", vars.session_id, "exercises"],
      });
    },
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; session_id: string }): Promise<void> => {
      const { error } = await supabase
        .from("training_exercises")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({
        queryKey: ["plan-sessions", vars.session_id, "exercises"],
      });
    },
  });
}

export function useSwapExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      a: PlanExercise;
      b: PlanExercise;
    }): Promise<void> => {
      const { error: errA } = await supabase
        .from("training_exercises")
        .update({ position: input.b.position })
        .eq("id", input.a.id);
      if (errA) throw errA;
      const { error: errB } = await supabase
        .from("training_exercises")
        .update({ position: input.a.position })
        .eq("id", input.b.id);
      if (errB) throw errB;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({
        queryKey: ["plan-sessions", vars.session_id, "exercises"],
      });
    },
  });
}
