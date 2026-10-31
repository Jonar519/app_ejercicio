import { create } from 'zustand';
import { cycleDay, cycleNumber } from '../../lib/cycle';
import { kvDelete, kvGet, kvSet } from '../../lib/idb';
import { enqueueOperation } from '../../lib/offline/sync';
import { fetchRemoteSession, saveLocalGlobalDay } from './api';
import { completeStep, createRun, isRunComplete, type RestDurations, type Run } from './run';
import { adjustCountdown, pauseTimer, resumeTimer } from './timer';

const RUN_KEY = 'run';

export interface Celebration {
  globalDay: number;
  nextGlobalDay: number;
  /** Número del ciclo recién terminado; null si el día no cierra un ciclo. */
  completedCycle: number | null;
}

interface RunnerState {
  userId: string | null;
  /** Ya se consultó IndexedDB para este usuario. */
  ready: boolean;
  run: Run | null;
  celebration: Celebration | null;
}

const INITIAL_STATE: RunnerState = { userId: null, ready: false, run: null, celebration: null };

export const useRunnerStore = create<RunnerState>(() => INITIAL_STATE);

export const resetRunner = () => useRunnerStore.setState(INITIAL_STATE);

// Las escrituras se encadenan para que la cola y el estado local conserven el orden de los pasos.
let writes = Promise.resolve();
const write = (task: () => Promise<unknown>) => {
  writes = writes.then(task).then(
    () => undefined,
    () => console.warn('No se pudo guardar el progreso local'),
  );
  return writes;
};

const requireUser = () => {
  const { userId } = useRunnerStore.getState();
  if (!userId) throw new Error('El entrenamiento no está cargado');
  return userId;
};

const updateRun = (update: (run: Run) => Run) => {
  const { run } = useRunnerStore.getState();
  if (!run) return;
  const userId = requireUser();
  const next = update(run);
  useRunnerStore.setState({ run: next });
  void write(() => kvSet(userId, RUN_KEY, next));
};

/** Recupera el día en curso. Un día anterior al activo ya se cerró: se descarta. */
export const loadRun = async (userId: string, globalDay: number) => {
  const stored = await kvGet<Run>(userId, RUN_KEY).catch(() => undefined);
  if (stored && stored.globalDay < globalDay)
    await kvDelete(userId, RUN_KEY).catch(() => undefined);
  useRunnerStore.setState({
    userId,
    ready: true,
    run: stored?.globalDay === globalDay ? stored : null,
  });
};

export const startRun = async (userId: string, globalDay: number, rests: RestDurations) => {
  const { run: current } = useRunnerStore.getState();
  if (current?.globalDay === globalDay) return;

  const remote = await fetchRemoteSession(userId, globalDay).catch(() => null);
  const now = Date.now();
  const run = createRun({
    globalDay,
    sessionId: remote?.id ?? crypto.randomUUID(),
    startedAt: remote?.startedAt ?? new Date(now).toISOString(),
    rests,
    setLogs: remote?.setLogs ?? [],
    cardioLog: remote?.cardioLog ?? null,
    now,
  });
  useRunnerStore.setState({ userId, ready: true, run });
  await write(async () => {
    await kvSet(userId, RUN_KEY, run);
    if (!remote) {
      await enqueueOperation(userId, {
        type: 'session_start',
        id: run.sessionId,
        globalDay,
        startedAt: run.startedAt,
      });
    }
  });
};

/** `stepIndex` evita avanzar dos veces por una doble pulsación o un efecto repetido. */
export const advanceStep = (stepIndex: number) => {
  const { run } = useRunnerStore.getState();
  if (!run || run.stepIndex !== stepIndex) return;
  const userId = requireUser();
  const { run: next, operations } = completeStep(run, Date.now());
  useRunnerStore.setState({ run: next });
  void write(async () => {
    for (const operation of operations) await enqueueOperation(userId, operation);
    await kvSet(userId, RUN_KEY, next);
  });
};

export const adjustRest = (deltaMs: number) =>
  updateRun((run) => ({ ...run, timer: adjustCountdown(run.timer, deltaMs, Date.now()) }));

export const togglePause = () =>
  updateRun((run) => ({
    ...run,
    timer:
      run.timer.runningSince === null
        ? resumeTimer(run.timer, Date.now())
        : pauseTimer(run.timer, Date.now()),
  }));

const closeDay = async (userId: string, globalDay: number) => {
  const nextGlobalDay = globalDay + 1;
  useRunnerStore.setState({
    run: null,
    celebration: {
      globalDay,
      nextGlobalDay,
      completedCycle: cycleDay(globalDay) === 31 ? cycleNumber(globalDay) : null,
    },
  });
  await write(async () => {
    await enqueueOperation(userId, { type: 'complete_day', globalDay });
    await saveLocalGlobalDay(userId, nextGlobalDay);
    await kvDelete(userId, RUN_KEY);
  });
  return nextGlobalDay;
};

/** Cierra un día de entrenamiento; devuelve el nuevo día o null si faltan pasos. */
export const finishDay = async () => {
  const { run } = useRunnerStore.getState();
  if (!run || !isRunComplete(run)) return null;
  return closeDay(requireUser(), run.globalDay);
};

/** Un descanso activo no tiene pasos, pero `complete_day` exige que exista su sesión. */
export const finishRestDay = async (userId: string, globalDay: number) => {
  await write(() =>
    enqueueOperation(userId, {
      type: 'session_start',
      id: crypto.randomUUID(),
      globalDay,
      startedAt: new Date().toISOString(),
    }),
  );
  return closeDay(userId, globalDay);
};

export const dismissCelebration = () => useRunnerStore.setState({ celebration: null });
