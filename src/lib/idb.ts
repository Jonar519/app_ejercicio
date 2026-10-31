import { userDatabaseName } from './localData';

const DATABASE_VERSION = 1;
const KV_STORE = 'kv';
const QUEUE_STORE = 'queue';

const connections = new Map<string, Promise<IDBDatabase>>();

const open = (userId: string) => {
  const name = userDatabaseName(userId);
  const existing = connections.get(name);
  if (existing) return existing;

  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(KV_STORE);
      request.result.createObjectStore(QUEUE_STORE, { keyPath: 'seq', autoIncrement: true });
    };
    request.onsuccess = () => {
      const database = request.result;
      // Sin esto, el borrado de la base al cerrar sesión quedaría bloqueado por esta conexión.
      database.onversionchange = () => {
        database.close();
        connections.delete(name);
      };
      resolve(database);
    };
    request.onerror = () => {
      connections.delete(name);
      reject(new Error('No se pudo abrir la base local'));
    };
  });
  connections.set(name, connection);
  return connection;
};

const transact = async <T>(
  userId: string,
  store: string,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
) => {
  const database = await open(userId);
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(new Error('Falló una operación de la base local'));
    transaction.onabort = () => reject(new Error('Falló una operación de la base local'));
  });
};

export const kvGet = <T>(userId: string, key: string) =>
  transact<T | undefined>(userId, KV_STORE, 'readonly', (store) => store.get(key));

export const kvSet = (userId: string, key: string, value: unknown) =>
  transact(userId, KV_STORE, 'readwrite', (store) => store.put(value, key));

export const kvDelete = (userId: string, key: string) =>
  transact(userId, KV_STORE, 'readwrite', (store) => store.delete(key));

export const queueAdd = (userId: string, item: object) =>
  transact(userId, QUEUE_STORE, 'readwrite', (store) => store.add(item));

/** Devuelve los elementos en orden de inserción. */
export const queueAll = <T>(userId: string) =>
  transact<T[]>(userId, QUEUE_STORE, 'readonly', (store) => store.getAll());

export const queuePut = (userId: string, item: object) =>
  transact(userId, QUEUE_STORE, 'readwrite', (store) => store.put(item));

export const queueDelete = (userId: string, seq: number) =>
  transact(userId, QUEUE_STORE, 'readwrite', (store) => store.delete(seq));
