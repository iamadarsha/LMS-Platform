const DB_NAME = "hyvemind-video-store";
const STORE_NAME = "videos";
const PREFIX = "hyvemind-video://";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createVideoRef(key: string) {
  return `${PREFIX}${encodeURIComponent(key)}`;
}

export function isStoredVideoRef(value?: string) {
  return Boolean(value?.startsWith(PREFIX));
}

function keyFromRef(ref: string) {
  return decodeURIComponent(ref.slice(PREFIX.length));
}

export async function saveVideoBlob(key: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function getStoredVideoBlob(ref: string) {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(keyFromRef(ref));
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob ?? null;
}

export async function getStoredVideoObjectUrl(ref: string) {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(keyFromRef(ref));
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob ? URL.createObjectURL(blob) : null;
}