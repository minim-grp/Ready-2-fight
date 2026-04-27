import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import { startOfWindowIso, type HistoryWindow } from "../../lib/trackingHistory";

export type WeightPoint = { date: string; weight_kg: number };

export function useWeightHistory(windowDays: HistoryWindow, today: Date = new Date()) {
  const userId = useAuthStore((s) => s.user?.id);
  const fromIso = startOfWindowIso(today, windowDays);

  return useQuery({
    enabled: !!userId,
    queryKey: ["weight-history", userId, windowDays, fromIso],
    queryFn: async (): Promise<WeightPoint[]> => {
      const { data, error } = await supabase
        .from("daily_tracking")
        .select("date, weight_kg")
        .eq("athlete_id", userId!)
        .gte("date", fromIso)
        .not("weight_kg", "is", null)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((r): r is { date: string; weight_kg: number } => r.weight_kg != null)
        .map((r) => ({ date: r.date, weight_kg: r.weight_kg }));
    },
  });
}
