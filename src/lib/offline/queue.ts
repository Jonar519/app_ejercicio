import { queueAdd, queueAll, queueDelete, queuePut } from '../idb';

export type Side = 'left' | 'right';

export type SyncOperation =
  | { type: 'session_start'; id: string; globalDay: number; startedAt: string }
  | {
      type: 'exercise_log';
      globalDay: number;
      exerciseKey: string;
      setNumber: number;
      side: Side | null;
      target: string;
      durationSeconds: number;
      completedAt: string;
    }
  | {
      type: 'cardio_log';
      globalDay: number;
      targetMinutes: number;
      actualSeconds: number;
      completedAt: string;
    }
  | { type: 'weight_log'; id: string; globalDay: number; weightKg: number; loggedAt: string }
  | { type: 'food_upsert'; id: string; logDate: string; name: string; calories: number }
  | { type: 'food_delete'; id: string }
  | { type: 'complete_day'; globalDay: number };

export interface QueueItem {
  /** Lo asigna IndexedDB y fija el orden de envío. */
  seq: number;
  id: string;
  operation: SyncOperation;
  attempts: number;
  nextAttemptAt: number;
  /** Rechazada de forma definitiva por el servidor: ya no se reintenta. */
  failed: boolean;
}

export interface FlushResult {
  synced: number;
  failed: number;
  /** Queda trabajo por un error transitorio. */
  blocked: boolean;
}

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

export const backoffMs = (attempts: number) =>
  Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);

export const enqueue = (userId: string, operation: SyncOperation) =>
  queueAdd(userId, {
    id: crypto.randomUUID(),
    operation,
    attempts: 0,
    nextAttemptAt: 0,
    failed: false,
  });

export const readQueue = (userId: string) => queueAll<QueueItem>(userId);

interface FlushOptions {
  execute: (operation: SyncOperation) => Promise<void>;
  isTransient: (error: unknown) => boolean;
  now?: number;
  /** Ignora la espera entre reintentos, por ejemplo al recuperar la conexión. */
  force?: boolean;
}

/**
 * Envía en orden estricto: un día no puede cerrarse antes que sus series. Un error transitorio
 * detiene el envío y uno definitivo aparta la operación para no bloquear las siguientes.
 */
export const flushQueue = async (
  userId: string,
  { execute, isTransient, now = Date.now(), force = false }: FlushOptions,
): Promise<FlushResult> => {
  const result: FlushResult = { synced: 0, failed: 0, blocked: false };
  const items = (await readQueue(userId)).filter((item) => !item.failed);

  for (const item of items) {
    if (!force && item.nextAttemptAt > now) {
      result.blocked = true;
      return result;
    }
    try {
      await execute(item.operation);
      await queueDelete(userId, item.seq);
      result.synced += 1;
    } catch (error) {
      if (isTransient(error)) {
        await queuePut(userId, {
          ...item,
          attempts: item.attempts + 1,
          nextAttemptAt: now + backoffMs(item.attempts),
        });
        result.blocked = true;
        return result;
      }
      await queuePut(userId, { ...item, failed: true });
      result.failed += 1;
    }
  }
  return result;
};
