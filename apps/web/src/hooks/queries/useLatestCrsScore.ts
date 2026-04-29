import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type LatestCrsScore = {
  test_id: string;
  score: number | null;
  rank: string | null;
  completed_at: string;
};

export function useLatestCrsScore() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["crs-tests", "latest", userId],
    queryFn: async (): Promise<LatestCrsScore | null> => {
      const { data, error } = await supabase
        .from("crs_tests")
        .select("id, score, rank_label, completed_at")
        .eq("athlete_id", userId!)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data || !data.completed_at) return null;
      return {
        test_id: data.id,
        score: data.score,
        rank: data.rank_label,
        completed_at: data.completed_at,
      };
    },
  });
}
