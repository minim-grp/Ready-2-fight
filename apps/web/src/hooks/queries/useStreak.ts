import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type { Tables } from "../../lib/database.types";

export type Streak = Tables<"streaks">;

export function useStreak() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["streaks", userId],
    queryFn: async (): Promise<Streak | null> => {
      const { data, error } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
