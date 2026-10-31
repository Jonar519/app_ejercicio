/** Prefijo de toda base IndexedDB de la app; cada una lleva además el user_id (`userDatabaseName`). */
const DATABASE_PREFIX = 'app-ejercicio';

/** La precaché de la app shell solo contiene estáticos públicos y permite abrir sin conexión. */
const PUBLIC_CACHE_PREFIX = 'workbox-precache';

const OWNED_STORAGE_PREFIXES = [DATABASE_PREFIX, 'sb-'];

export const userDatabaseName = (userId: string) => `${DATABASE_PREFIX}:${userId}`;

const deleteDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('No se pudo borrar la base local'));
    request.onblocked = () => resolve();
  });

const clearDatabases = async () => {
  if (!('indexedDB' in globalThis)) return;
  const databases = await indexedDB.databases();
  await Promise.all(
    databases
      .flatMap(({ name }) => (name?.startsWith(DATABASE_PREFIX) ? [name] : []))
      .map(deleteDatabase),
  );
};

const clearCaches = async () => {
  if (!('caches' in globalThis)) return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => !name.startsWith(PUBLIC_CACHE_PREFIX))
      .map((name) => caches.delete(name)),
  );
};

const clearStorage = (storage: Storage) => {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (key && OWNED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
};

/** Borra lo que la app guarda en el dispositivo. Un fallo no impide limpiar el resto. */
export const clearLocalData = async () => {
  clearStorage(localStorage);
  clearStorage(sessionStorage);
  const results = await Promise.allSettled([clearDatabases(), clearCaches()]);
  if (results.some((result) => result.status === 'rejected')) {
    console.warn('No se pudieron borrar todos los datos locales');
  }
};
