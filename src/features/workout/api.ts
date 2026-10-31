import { z } from 'zod';
import { kvGet, kvSet } from '../../lib/idb';
import { isNetworkFailure } from '../../lib/offline/errors';
import { readQueue } from '../../lib/offline/queue';
import { supabase } from '../../lib/supabase';
import { dayExercises, programDayFor } from './plan';
import type { CardioLog, SetLog } from './run';

const PROGRESS_KEY = 'progress';
const REMOTE_SESSION_TIMEOUT_MS = 3000;

const progressSchema = z.object({ global_day: z.number().int().min(1) });

const sessionSchema = z.object({
  id: z.uuid(),
  started_at: z.string(),
  status: z.enum(['in_progress', 'completed']),
});

const exerciseLogSchema = z.object({
  exercise_key: z.string(),
  set_number: z.number(),
  side: z.enum(['left', 'right']).nullable(),
  duration_seconds: z.number(),
});

const cardioLogSchema = z.object({ target_minutes: z.number(), actual_seconds: z.number() });

const fetchGlobalDay = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_progress')
    .select('global_day')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return progressSchema.parse(data).global_day;
};

export const saveLocalGlobalDay = (userId: string, globalDay: number) =>
  kvSet(userId, PROGRESS_KEY, globalDay);

/**
 * El avance offline va por delante del servidor hasta que la cola se vacía. Sin nada pendiente manda
 * el servidor: así se corrige un día local que el servidor llegara a rechazar.
 */
export const loadGlobalDay = async (userId: string) => {
  const local = await kvGet<number>(userId, PROGRESS_KEY).catch(() => undefined);
  let server: number;
  try {
    server = await fetchGlobalDay(userId);
  } catch (error) {
    if (local === undefined || !isNetworkFailure(error)) throw error;
    return local;
  }
  const queue = await readQueue(userId).catch(() => []);
  const hasPending = queue.some((item) => !item.failed);
  const globalDay = hasPending && local !== undefined ? Math.max(local, server) : server;
  await saveLocalGlobalDay(userId, globalDay).catch(() => undefined);
  return globalDay;
};

export interface RemoteSession {
  id: string;
  startedAt: string;
  setLogs: SetLog[];
  cardioLog: CardioLog | null;
}

/** Sesión abierta en el servidor por otro dispositivo; null si no hay o no se puede consultar. */
export const fetchRemoteSession = async (
  userId: string,
  globalDay: number,
): Promise<RemoteSession | null> => {
  if (!navigator.onLine) return null;
  const signal = AbortSignal.timeout(REMOTE_SESSION_TIMEOUT_MS);
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, started_at, status')
    .eq('user_id', userId)
    .eq('global_day', globalDay)
    .abortSignal(signal)
    .maybeSingle();
  if (error || !data) return null;
  const session = sessionSchema.parse(data);
  if (session.status !== 'in_progress') return null;

  const [exercises, cardio] = await Promise.all([
    supabase
      .from('exercise_logs')
      .select('exercise_key, set_number, side, duration_seconds')
      .eq('session_id', session.id)
      .abortSignal(signal),
    supabase
      .from('cardio_logs')
      .select('target_minutes, actual_seconds')
      .eq('session_id', session.id)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  if (exercises.error || cardio.error) return null;

  const names = new Map(
    dayExercises(programDayFor(globalDay)).map((exercise) => [exercise.key, exercise.name]),
  );
  const cardioLog = cardio.data ? cardioLogSchema.parse(cardio.data) : null;
  return {
    id: session.id,
    startedAt: session.started_at,
    setLogs: z
      .array(exerciseLogSchema)
      .parse(exercises.data)
      .map((log) => ({
        exerciseKey: log.exercise_key,
        exerciseName: names.get(log.exercise_key) ?? log.exercise_key,
        setNumber: log.set_number,
        side: log.side,
        durationSeconds: log.duration_seconds,
      })),
    cardioLog: cardioLog && {
      targetMinutes: cardioLog.target_minutes,
      actualSeconds: cardioLog.actual_seconds,
    },
  };
};
