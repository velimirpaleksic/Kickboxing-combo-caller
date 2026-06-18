const DB_NAME = 'kombinacije-voice-pack';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

let dbPromise;

const canUseIndexedDb = () => typeof window !== 'undefined' && 'indexedDB' in window;

const openDb = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB nije dostupan u ovom browseru.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'audioKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async (mode, action) => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveClip = async (audioKey, blob, label = '') => {
  const now = Date.now();
  const existing = await getClip(audioKey);
  const clip = {
    audioKey,
    label,
    blob,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await withStore('readwrite', (store) => store.put(clip));
  return clip;
};

export const getClip = async (audioKey) => {
  if (!audioKey) return null;

  try {
    return (await withStore('readonly', (store) => store.get(audioKey))) || null;
  } catch {
    return null;
  }
};

export const deleteClip = async (audioKey) => {
  if (!audioKey) return;
  await withStore('readwrite', (store) => store.delete(audioKey));
};

export const listClips = async () => {
  try {
    return (await withStore('readonly', (store) => store.getAll())) || [];
  } catch {
    return [];
  }
};

export const hasClip = async (audioKey) => Boolean(await getClip(audioKey));
