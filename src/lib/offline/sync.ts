import { create } from 'zustand';
import { isTransientError } from './errors';
import { executeOperation } from './executeOperation';
import { enqueue, flushQueue, readQueue, type SyncOperation } from './queue';

const RETRY_INTERVAL_MS = 15_000;

interface SyncState {
  online: boolean;
  syncing: boolean;
  /** Operaciones aún por enviar. */
  pending: number;
  /** Operaciones rechazadas por el servidor. */
  failed: number;
}

export const useSyncStore = create<SyncState>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  failed: 0,
}));

let onSynced: () => void = () => undefined;
let activeFlush: Promise<void> | null = null;
let flushAgain = false;

const refreshCounts = async (userId: string) => {
  const items = await readQueue(userId);
  const failed = items.filter((item) => item.failed).length;
  useSyncStore.setState({ pending: items.length - failed, failed });
};

const runFlush = async (userId: string, force: boolean) => {
  useSyncStore.setState({ syncing: true });
  try {
    do {
      flushAgain = false;
      const { synced, failed } = await flushQueue(userId, {
        execute: executeOperation,
        isTransient: isTransientError,
        force,
      });
      await refreshCounts(userId);
      if (synced + failed > 0) onSynced();
    } while (flushAgain);
  } finally {
    useSyncStore.setState({ syncing: false });
  }
};

/** Envía lo pendiente. Las llamadas durante un envío se agrupan en una pasada más. */
export const flushNow = (userId: string, force = false) => {
  if (!useSyncStore.getState().online) return Promise.resolve();
  if (activeFlush) {
    flushAgain = true;
    return activeFlush;
  }
  activeFlush = runFlush(userId, force)
    .catch(() => console.warn('No se pudo sincronizar'))
    .finally(() => {
      activeFlush = null;
    });
  return activeFlush;
};

export const enqueueOperation = async (userId: string, operation: SyncOperation) => {
  await enqueue(userId, operation);
  await refreshCounts(userId);
  void flushNow(userId);
};

/** Mantiene la sincronización mientras haya sesión y devuelve la función que la detiene. */
export const startSync = (userId: string, handleSynced: () => void) => {
  onSynced = handleSynced;

  const handleOnline = () => {
    useSyncStore.setState({ online: true });
    void flushNow(userId, true);
  };
  const handleOffline = () => useSyncStore.setState({ online: false });
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') void flushNow(userId, true);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);
  const retryTimer = setInterval(() => void flushNow(userId), RETRY_INTERVAL_MS);

  void refreshCounts(userId).then(() => flushNow(userId, true));

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(retryTimer);
    onSynced = () => undefined;
  };
};
