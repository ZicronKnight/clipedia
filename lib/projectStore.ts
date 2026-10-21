// Capa mínima de IndexedDB para Clipedia Studio.
// Guarda los blobs de media (assetId -> File/Blob) y el autosave del proyecto.
// Nada de esto sale del navegador: coherente con el manifiesto de privacidad.

export type StoredProject = {
  version: 1;
  savedAt: number;
  settings: any;
  clips: any[];
  imageOverlays: any[];
  textOverlays: any[];
  audioTracks: any[];
};

const DB_NAME = 'clipedia-studio';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_PROJECT = 'project';
const PROJECT_KEY = 'current';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS);
      if (!db.objectStoreNames.contains(STORE_PROJECT)) db.createObjectStore(STORE_PROJECT);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export function putAsset(id: string, blob: Blob): Promise<unknown> {
  return run(STORE_ASSETS, 'readwrite', (s) => s.put(blob, id));
}

export async function getAsset(id: string): Promise<Blob | null> {
  const blob = await run<Blob | undefined>(STORE_ASSETS, 'readonly', (s) => s.get(id));
  return blob ?? null;
}

export function saveProject(p: StoredProject): Promise<unknown> {
  return run(STORE_PROJECT, 'readwrite', (s) => s.put(p, PROJECT_KEY));
}

export async function loadProject(): Promise<StoredProject | null> {
  const p = await run<StoredProject | undefined>(STORE_PROJECT, 'readonly', (s) => s.get(PROJECT_KEY));
  return p ?? null;
}

export function clearProject(): Promise<unknown> {
  return run(STORE_PROJECT, 'readwrite', (s) => s.delete(PROJECT_KEY));
}