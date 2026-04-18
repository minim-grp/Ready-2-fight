import type { TablesInsert } from "./database.types";

const DB_NAME = "r2f-offline";
const DB_VERSION = 1;
const STORE_TRACKING = "daily_tracking_queue";

export type QueuedTrackingUpsert = {
  client_uuid: string;
  athlete_id: string;
  date: string;
  row: TablesInsert<"daily_tracking">;
  queued_at: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKING)) {
        db.createObjectStore(STORE_TRACKING, { keyPath: "client_uuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_TRACKING, mode);
    const result = await fn(tx.objectStore(STORE_TRACKING));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function putTrackingQueue(entry: QueuedTrackingUpsert): Promise<void> {
  await withStore("readwrite", (s) => reqToPromise(s.put(entry)));
}

export async function getAllTrackingQueue(): Promise<QueuedTrackingUpsert[]> {
  return withStore("readonly", (s) =>
    reqToPromise(s.getAll() as IDBRequest<QueuedTrackingUpsert[]>),
  );
}

export async function deleteTrackingQueue(clientUuid: string): Promise<void> {
  await withStore("readwrite", (s) => reqToPromise(s.delete(clientUuid)));
}

export async function clearTrackingQueue(): Promise<void> {
  await withStore("readwrite", (s) => reqToPromise(s.clear()));
}
