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
