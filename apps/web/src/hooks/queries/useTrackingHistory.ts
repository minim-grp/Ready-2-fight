import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import { startOfWindowIso, type HistoryWindow } from "../../lib/trackingHistory";

export function useTrackingHistory(windowDays: HistoryWindow, today: Date = new Date()) {
  const userId = useAuthStore((s) => s.user?.id);
  const fromIso = startOfWindowIso(today, windowDays);

  return useQuery({
    enabled: !!userId,
    queryKey: ["tracking-history", userId, windowDays, fromIso],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("daily_tracking")
        .select("date")
        .eq("athlete_id", userId!)
        .gte("date", fromIso)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => r.date);
    },
  });
}
