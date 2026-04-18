import type { QueryClient } from "@tanstack/react-query";
import {
  deleteTrackingQueue,
  getAllTrackingQueue,
  putTrackingQueue,
  type QueuedTrackingUpsert,
} from "./offlineDb";
import type { TablesInsert } from "./database.types";
import { logger } from "./logger";
import { supabase } from "./supabase";

export type TrackingInsertRow = TablesInsert<"daily_tracking"> & {
  athlete_id: string;
  date: string;
  client_uuid: string;
};

export async function enqueueTrackingUpsert(
  row: TrackingInsertRow,
): Promise<QueuedTrackingUpsert> {
  const existing = await getAllTrackingQueue();
  for (const e of existing) {
    if (
      e.athlete_id === row.athlete_id &&
      e.date === row.date &&
      e.client_uuid !== row.client_uuid
    ) {
      await deleteTrackingQueue(e.client_uuid);
    }
  }
  const entry: QueuedTrackingUpsert = {
    client_uuid: row.client_uuid,
    athlete_id: row.athlete_id,
    date: row.date,
    row,
    queued_at: Date.now(),
  };
  await putTrackingQueue(entry);
  return entry;
}

export type UpsertRunner = (row: TablesInsert<"daily_tracking">) => Promise<void>;

export type FlushResult = {
  succeeded: QueuedTrackingUpsert[];
  failed: { entry: QueuedTrackingUpsert; error: unknown }[];
};

async function defaultUpsertRunner(row: TablesInsert<"daily_tracking">): Promise<void> {
  const { error } = await supabase
    .from("daily_tracking")
    .upsert(row, { onConflict: "athlete_id,date" });
  if (error) throw error;
}

export async function flushTrackingQueue(
  runner: UpsertRunner = defaultUpsertRunner,
): Promise<FlushResult> {
  const entries = await getAllTrackingQueue();
  const succeeded: QueuedTrackingUpsert[] = [];
  const failed: FlushResult["failed"] = [];
  for (const entry of entries) {
    try {
      await runner(entry.row);
      await deleteTrackingQueue(entry.client_uuid);
      succeeded.push(entry);
    } catch (err) {
      logger.warn("offline flush failed", entry.client_uuid, err);
      failed.push({ entry, error: err });
    }
  }
  return { succeeded, failed };
}

export function startOfflineFlushWatcher(queryClient: QueryClient): () => void {
  let running = false;
  async function attempt() {
    if (running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    running = true;
    try {
      const result = await flushTrackingQueue();
      if (result.succeeded.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ["daily_tracking"] });
      }
    } catch (err) {
      logger.warn("offline flush watcher error", err);
    } finally {
      running = false;
    }
  }
  const handler = () => {
    void attempt();
  };
  window.addEventListener("online", handler);
  void attempt();
  return () => {
    window.removeEventListener("online", handler);
  };
}
