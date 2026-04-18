import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type { Tables, TablesInsert } from "../../lib/database.types";
import { enqueueTrackingUpsert, type TrackingInsertRow } from "../../lib/offlineQueue";
import { logger } from "../../lib/logger";

export type DailyTracking = Tables<"daily_tracking">;

export type DailyTrackingInput = Omit<
  TablesInsert<"daily_tracking">,
  "id" | "athlete_id" | "date" | "created_at" | "updated_at" | "srpe"
>;

export type UpsertResult = {
  row: DailyTracking;
  queuedOffline: boolean;
};

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

function buildOptimisticRow(
  row: TrackingInsertRow,
  existing: DailyTracking | null,
): DailyTracking {
  const now = new Date().toISOString();
  const trained = row.trained ?? false;
  const rpe = trained ? (row.rpe ?? null) : null;
  const duration = trained ? (row.duration_min ?? null) : null;
  const srpe = rpe != null && duration != null ? rpe * duration : null;
  return {
    id: existing?.id ?? crypto.randomUUID(),
    athlete_id: row.athlete_id,
    date: row.date,
    sleep_quality: row.sleep_quality ?? null,
    weight_kg: row.weight_kg ?? null,
    mood: row.mood ?? null,
    water_l: row.water_l ?? null,
    physical_condition: row.physical_condition ?? null,
    calories_kcal: row.calories_kcal ?? null,
    activity_level: row.activity_level ?? null,
    trained,
    rpe,
    duration_min: duration,
    srpe,
    soreness: row.soreness ?? false,
    soreness_region: row.soreness ? (row.soreness_region ?? null) : null,
    notes: row.notes ?? null,
    engagement_id: row.engagement_id ?? null,
    client_uuid: row.client_uuid,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function useUpsertTodayTracking() {
  const userId = useAuthStore((s) => s.user?.id);
  const date = todayIso();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DailyTrackingInput): Promise<UpsertResult> => {
      if (!userId) throw new Error("not authenticated");
      const clientUuid = input.client_uuid ?? crypto.randomUUID();
      const row: TrackingInsertRow = {
        ...input,
        athlete_id: userId,
        date,
        client_uuid: clientUuid,
      };

      const existing = qc.getQueryData<DailyTracking | null>([
        "daily_tracking",
        userId,
        date,
      ]);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueTrackingUpsert(row);
        return { row: buildOptimisticRow(row, existing ?? null), queuedOffline: true };
      }

      try {
        const { data, error } = await supabase
          .from("daily_tracking")
          .upsert(row, { onConflict: "athlete_id,date" })
          .select()
          .single();
        if (error) throw error;
        return { row: data, queuedOffline: false };
      } catch (err) {
        if (
          typeof navigator !== "undefined" &&
          !navigator.onLine &&
          err instanceof Error
        ) {
          logger.warn("tracking upsert fiel zurueck in Offline-Queue", err.message);
          await enqueueTrackingUpsert(row);
          return { row: buildOptimisticRow(row, existing ?? null), queuedOffline: true };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      qc.setQueryData(["daily_tracking", userId, date], result.row);
    },
  });
}
