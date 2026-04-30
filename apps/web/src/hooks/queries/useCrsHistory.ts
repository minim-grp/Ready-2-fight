import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type CrsHistoryPoint = {
  test_id: string;
  score: number;
  rank: string | null;
  completed_at: string;
};

export function useCrsHistory() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["crs-tests", "history", userId],
    queryFn: async (): Promise<CrsHistoryPoint[]> => {
      const { data, error } = await supabase
        .from("crs_tests")
        .select("id, score, rank_label, completed_at")
        .eq("athlete_id", userId!)
        .eq("status", "completed")
        .not("score", "is", null)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: true });

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
