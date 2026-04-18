import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTrackingQueue, getAllTrackingQueue } from "./offlineDb";
import {
  enqueueTrackingUpsert,
  flushTrackingQueue,
  type TrackingInsertRow,
} from "./offlineQueue";

function makeRow(overrides: Partial<TrackingInsertRow> = {}): TrackingInsertRow {
  return {
    athlete_id: "a1",
    date: "2026-04-18",
    client_uuid: "uuid-1",
    sleep_quality: "gut",
    mood: "gut",
    physical_condition: "gut",
    weight_kg: 75,
    water_l: 2,
    trained: false,
    soreness: false,
    ...overrides,
  };
}

describe("offlineQueue", () => {
  beforeEach(async () => {
    await clearTrackingQueue();
  });

  afterEach(async () => {
    await clearTrackingQueue();
  });

  describe("enqueueTrackingUpsert", () => {
    it("persists eine Entry im Queue", async () => {
      await enqueueTrackingUpsert(makeRow());
      const all = await getAllTrackingQueue();
      expect(all).toHaveLength(1);
      expect(all[0]?.client_uuid).toBe("uuid-1");
      expect(all[0]?.row.weight_kg).toBe(75);
      expect(all[0]?.queued_at).toBeGreaterThan(0);
    });

    it("ersetzt vorhandene Entry fuer dasselbe (athlete, date)", async () => {
      await enqueueTrackingUpsert(makeRow({ client_uuid: "uuid-old", weight_kg: 70 }));
      await enqueueTrackingUpsert(makeRow({ client_uuid: "uuid-new", weight_kg: 72 }));
      const all = await getAllTrackingQueue();
      expect(all).toHaveLength(1);
      expect(all[0]?.client_uuid).toBe("uuid-new");
      expect(all[0]?.row.weight_kg).toBe(72);
    });

    it("haelt Entries fuer andere Tage getrennt", async () => {
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u1", date: "2026-04-17" }));
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u2", date: "2026-04-18" }));
      const all = await getAllTrackingQueue();
      expect(all).toHaveLength(2);
    });

    it("haelt Entries fuer andere Athleten getrennt", async () => {
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u1", athlete_id: "a1" }));
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u2", athlete_id: "a2" }));
      const all = await getAllTrackingQueue();
      expect(all).toHaveLength(2);
    });
  });

  describe("flushTrackingQueue", () => {
    it("ruft Runner pro Entry auf und leert die Queue bei Erfolg", async () => {
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u1" }));
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u2", date: "2026-04-17" }));
      const runner = vi.fn().mockResolvedValue(undefined);
      const result = await flushTrackingQueue(runner);
      expect(runner).toHaveBeenCalledTimes(2);
      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(await getAllTrackingQueue()).toHaveLength(0);
    });

    it("laesst fehlgeschlagene Entries in der Queue", async () => {
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u1" }));
      await enqueueTrackingUpsert(makeRow({ client_uuid: "u2", date: "2026-04-17" }));
      const runner = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("network"));
      const result = await flushTrackingQueue(runner);
      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      const remaining = await getAllTrackingQueue();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.client_uuid).toBe(result.failed[0]?.entry.client_uuid);
    });

    it("leere Queue ergibt leeres Resultat", async () => {
      const runner = vi.fn();
      const result = await flushTrackingQueue(runner);
      expect(runner).not.toHaveBeenCalled();
      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });
});
