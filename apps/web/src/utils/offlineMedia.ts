// Photos taken with no connection wait here until the offline queue can upload them. IndexedDB, not
// localStorage: it stores Blobs natively and is not capped at a few megabytes.
const DB = "pramaan-offline";
const STORE = "media";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const saveOfflineMedia = (key: string, blob: Blob) => run("readwrite", (s) => s.put(blob, key)).then(() => undefined);
export const loadOfflineMedia = (key: string) => run<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteOfflineMedia = (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined);
