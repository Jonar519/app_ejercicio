import type { Side, SyncOperation } from '../../lib/offline/queue';
import { buildSteps, formatTarget, programDayFor, targetSeconds, type Step } from './plan';
import { elapsedMs, startCountdown, startStopwatch, toWholeSeconds, type Timer } from './timer';

/** Topes de `exercise_logs.duration_seconds` y `cardio_logs.actual_seconds`. */
const MAX_SET_SECONDS = 7200;
const MAX_CARDIO_SECONDS = 14400;

export interface RestDurations {
  betweenSets: number;
  betweenExercises: number;
}

export interface SetLog {
  exerciseKey: string;
  exerciseName: string;
  setNumber: number;
  side: Side | null;
  durationSeconds: number;
}

export interface CardioLog {
  targetMinutes: number;
  actualSeconds: number;
}

/** Progreso completo de un día en curso. Es JSON puro: se guarda tal cual en IndexedDB. */
export interface Run {
  globalDay: number;
  sessionId: string;
  startedAt: string;
  rests: RestDurations;
  stepIndex: number;
  timer: Timer;
  setLogs: SetLog[];
  cardioLog: CardioLog | null;
}

export const runSteps = (run: Pick<Run, 'globalDay'>) => buildSteps(programDayFor(run.globalDay));

export const currentStep = (run: Run): Step => {
  const step = runSteps(run)[run.stepIndex];
  if (!step) throw new Error('Paso inexistente');
  return step;
};

const timerForStep = (step: Step, rests: RestDurations, now: number): Timer => {
  switch (step.kind) {
    case 'set': {
      const seconds = targetSeconds(step.exercise);
      return seconds === null ? startStopwatch(now) : startCountdown(seconds * 1000, now);
    }
    case 'rest':
      return startCountdown(
        (step.rest === 'set' ? rests.betweenSets : rests.betweenExercises) * 1000,
        now,
      );
    case 'cardio':
      return startCountdown(step.minutes * 60_000, now);
    case 'summary':
      return startStopwatch(now);
  }
};

const isLogged = (step: Step, run: Pick<Run, 'setLogs' | 'cardioLog'>) => {
  if (step.kind === 'cardio') return run.cardioLog !== null;
  if (step.kind !== 'set') return true;
  return run.setLogs.some(
    (log) =>
      log.exerciseKey === step.exercise.key &&
      log.setNumber === step.setNumber &&
      log.side === step.side,
  );
};

interface CreateRunInput {
  globalDay: number;
  sessionId: string;
  startedAt: string;
  rests: RestDurations;
  setLogs?: SetLog[];
  cardioLog?: CardioLog | null;
  now: number;
}

/** Abre el día; con registros previos de otro dispositivo continúa en el primer paso sin hacer. */
export const createRun = ({
  setLogs = [],
  cardioLog = null,
  now,
  ...input
}: CreateRunInput): Run => {
  const steps = runSteps(input);
  const pending = steps.findIndex(
    (step) =>
      step.kind !== 'rest' && (step.kind === 'summary' || !isLogged(step, { setLogs, cardioLog })),
  );
  const stepIndex = Math.max(pending, 0);
  const step = steps[stepIndex];
  if (!step) throw new Error('Paso inexistente');
  return { ...input, setLogs, cardioLog, stepIndex, timer: timerForStep(step, input.rests, now) };
};

const moveToNextStep = (run: Run, now: number): Run => {
  const steps = runSteps(run);
  const stepIndex = Math.min(run.stepIndex + 1, steps.length - 1);
  const step = steps[stepIndex];
  if (!step) throw new Error('Paso inexistente');
  return { ...run, stepIndex, timer: timerForStep(step, run.rests, now) };
};

interface StepResult {
  run: Run;
  operations: SyncOperation[];
}

/** Cierra el paso actual, registra su tiempo real y pasa al siguiente. */
export const completeStep = (run: Run, now: number): StepResult => {
  const step = currentStep(run);
  const completedAt = new Date(now).toISOString();
  const seconds = toWholeSeconds(elapsedMs(run.timer, now));

  if (step.kind === 'set') {
    const durationSeconds = Math.min(seconds, MAX_SET_SECONDS);
    const log: SetLog = {
      exerciseKey: step.exercise.key,
      exerciseName: step.exercise.name,
      setNumber: step.setNumber,
      side: step.side,
      durationSeconds,
    };
    return {
      run: moveToNextStep({ ...run, setLogs: [...run.setLogs, log] }, now),
      operations: [
        {
          type: 'exercise_log',
          globalDay: run.globalDay,
          exerciseKey: log.exerciseKey,
          setNumber: log.setNumber,
          side: log.side,
          target: formatTarget(step.exercise),
          durationSeconds,
          completedAt,
        },
      ],
    };
  }

  if (step.kind === 'cardio') {
    const cardioLog = {
      targetMinutes: step.minutes,
      actualSeconds: Math.min(seconds, MAX_CARDIO_SECONDS),
    };
    return {
      run: moveToNextStep({ ...run, cardioLog }, now),
      operations: [{ type: 'cardio_log', globalDay: run.globalDay, ...cardioLog, completedAt }],
    };
  }

  return { run: moveToNextStep(run, now), operations: [] };
};

export interface ExerciseSummary {
  key: string;
  name: string;
  seconds: number;
}

export interface RunSummary {
  totalSeconds: number;
  exercises: ExerciseSummary[];
  cardioSeconds: number | null;
}

/** El tiempo de un ejercicio es la suma de sus series. Coincide con `total_seconds` del servidor. */
export const summarizeRun = ({
  setLogs,
  cardioLog,
}: Pick<Run, 'setLogs' | 'cardioLog'>): RunSummary => {
  const exercises = new Map<string, ExerciseSummary>();
  for (const log of setLogs) {
    const entry = exercises.get(log.exerciseKey);
    if (entry) entry.seconds += log.durationSeconds;
    else {
      exercises.set(log.exerciseKey, {
        key: log.exerciseKey,
        name: log.exerciseName,
        seconds: log.durationSeconds,
      });
    }
  }
  const list = [...exercises.values()];
  const cardioSeconds = cardioLog?.actualSeconds ?? null;
  return {
    totalSeconds: list.reduce((sum, item) => sum + item.seconds, 0) + (cardioSeconds ?? 0),
    exercises: list,
    cardioSeconds,
  };
};

export const isRunComplete = (run: Run) => runSteps(run).every((step) => isLogged(step, run));
