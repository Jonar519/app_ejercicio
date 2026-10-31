/**
 * Temporizador basado en marcas de tiempo: nunca acumula ticks, así que sigue siendo exacto si la
 * pestaña se suspende. Es JSON puro para poder guardarlo tal cual en IndexedDB.
 */
export interface Timer {
  /** Duración objetivo; null en un cronómetro libre. */
  durationMs: number | null;
  /** Tiempo ya transcurrido antes del último arranque. */
  accumulatedMs: number;
  /** Marca del último arranque; null si está en pausa. */
  runningSince: number | null;
}

export const startStopwatch = (now: number): Timer => ({
  durationMs: null,
  accumulatedMs: 0,
  runningSince: now,
});

export const startCountdown = (durationMs: number, now: number): Timer => ({
  durationMs,
  accumulatedMs: 0,
  runningSince: now,
});

const rawElapsedMs = (timer: Timer, now: number) =>
  timer.accumulatedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));

/** Tiempo real transcurrido. Una cuenta atrás no pasa de su duración. */
export const elapsedMs = (timer: Timer, now: number) => {
  const elapsed = rawElapsedMs(timer, now);
  return timer.durationMs === null ? elapsed : Math.min(elapsed, timer.durationMs);
};

export const remainingMs = (timer: Timer, now: number) =>
  timer.durationMs === null ? 0 : Math.max(0, timer.durationMs - rawElapsedMs(timer, now));

export const isFinished = (timer: Timer, now: number) =>
  timer.durationMs !== null && remainingMs(timer, now) === 0;

export const pauseTimer = (timer: Timer, now: number): Timer =>
  timer.runningSince === null
    ? timer
    : { ...timer, accumulatedMs: rawElapsedMs(timer, now), runningSince: null };

export const resumeTimer = (timer: Timer, now: number): Timer =>
  timer.runningSince === null ? { ...timer, runningSince: now } : timer;

/** Suma o resta tiempo a una cuenta atrás; recortar más de lo que queda la termina. */
export const adjustCountdown = (timer: Timer, deltaMs: number, now: number): Timer => {
  if (timer.durationMs === null) return timer;
  const minimum = rawElapsedMs(timer, now);
  return { ...timer, durationMs: Math.max(minimum, timer.durationMs + deltaMs) };
};

export const toWholeSeconds = (milliseconds: number) => Math.round(milliseconds / 1000);
