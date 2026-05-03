import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type Competition = {
  id: string;
  athlete_id: string;
  title: string;
  competition_date: string;
  discipline: string | null;
  weight_class: string | null;
  location: string | null;
  result: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitionInput = {
  title: string;
  competition_date: string;
  discipline: string | null;
  weight_class: string | null;
  location: string | null;
  result: string | null;
  notes: string | null;
};

// Liste der Wettkaempfe des aktuellen Athleten — RLS comp_self_all begrenzt
// athletes auf athlete_id = auth.uid() (athlete_profiles.id == users.id).
export function useCompetitions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!userId,
    queryKey: ["competitions", userId],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase
        .from("competitions")
        .select(
          "id, athlete_id, title, competition_date, discipline, weight_class, location, result, notes, created_at, updated_at",
        )
        .eq("athlete_id", userId!)
        .order("competition_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
  });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: CompetitionInput): Promise<string> => {
      if (!userId) throw new Error("not_authenticated");
      const { data, error } = await supabase
        .from("competitions")
        .insert({ ...input, athlete_id: userId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["competitions", userId] });
    },
  });
}

export function useUpdateCompetition() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { id: string; patch: CompetitionInput }): Promise<void> => {
      const { error } = await supabase
        .from("competitions")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["competitions", userId] });
    },
  });
}

export function useDeleteCompetition() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("competitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["competitions", userId] });
    },
  });
}
