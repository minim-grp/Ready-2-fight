import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type { Tables, TablesInsert } from "../../lib/database.types";

export type DailyTracking = Tables<"daily_tracking">;

export type DailyTrackingInput = Omit<
  TablesInsert<"daily_tracking">,
  "id" | "athlete_id" | "date" | "created_at" | "updated_at" | "srpe"
>;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function useTodayTracking() {
  const userId = useAuthStore((s) => s.user?.id);
  const date = todayIso();

  return useQuery({
    enabled: !!userId,
    queryKey: ["daily_tracking", userId, date],
    queryFn: async (): Promise<DailyTracking | null> => {
      const { data, error } = await supabase
        .from("daily_tracking")
        .select("*")
        .eq("athlete_id", userId!)
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertTodayTracking() {
  const userId = useAuthStore((s) => s.user?.id);
  const date = todayIso();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DailyTrackingInput): Promise<DailyTracking> => {
      if (!userId) throw new Error("not authenticated");
      const row: TablesInsert<"daily_tracking"> = {
        ...input,
        athlete_id: userId,
        date,
      };
      const { data, error } = await supabase
        .from("daily_tracking")
        .upsert(row, { onConflict: "athlete_id,date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["daily_tracking", userId, date], data);
    },
  });
}
