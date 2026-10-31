import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { SETS_PER_EXERCISE } from '../../data/program';
import { formatClock } from '../../lib/format';
import { SyncIndicator } from '../pwa/SyncIndicator';
import { useSettings } from '../profile/hooks';
import { playAlert, type AlertPreferences } from './alerts';
import { useLoadRun, useNow, useProgress, useWakeLock } from './hooks';
import { dayExercises, formatTarget, programDayFor, targetSeconds, type Step } from './plan';
import { currentStep, type Run } from './run';
import { adjustRest, advanceStep, togglePause, useRunnerStore } from './runnerStore';
import { SummaryStep } from './SummaryStep';
import { elapsedMs, isFinished, remainingMs } from './timer';

const REST_ADJUST_MS = 15_000;
const WARNING_SECONDS = 10;

const SIDE_LABELS = { left: 'Lado izquierdo', right: 'Lado derecho' };

const actionClass = 'min-h-20 w-full text-xl';

export function RunnerPage() {
  const progress = useProgress();
  const settings = useSettings();
  const run = useRunnerStore((state) => state.run);
  const ready = useRunnerStore((state) => state.ready);
  useLoadRun(progress.data);

  if (progress.isError || settings.isError) {
    return (
      <Screen>
        <FormMessage kind="error">No se pudo cargar el entrenamiento.</FormMessage>
        <Link to="/entrenamiento" className="link-action">
          Volver a Hoy
        </Link>
      </Screen>
    );
  }
  if (!ready || !settings.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!run) return <Navigate to="/entrenamiento" replace />;

  return (
    <Screen>
      <ActiveStep
        run={run}
        alerts={{ sound: settings.data.sound_enabled, vibration: settings.data.vibration_enabled }}
      />
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <Link
          to="/entrenamiento"
          className="inline-flex size-11 items-center justify-center rounded-lg"
          aria-label="Salir al resumen de Hoy"
        >
          <X aria-hidden="true" />
        </Link>
        <SyncIndicator />
      </header>
      {children}
    </main>
  );
}

interface ActiveStepProps {
  run: Run;
  alerts: AlertPreferences;
}

function ActiveStep({ run, alerts }: ActiveStepProps) {
  const step = currentStep(run);
  useWakeLock();

  if (step.kind === 'summary') return <SummaryStep run={run} />;
  return <TimedStep key={run.stepIndex} run={run} step={step} alerts={alerts} />;
}

interface TimedStepProps extends ActiveStepProps {
  step: Exclude<Step, { kind: 'summary' }>;
}

const stepHeading = (run: Run, step: TimedStepProps['step']) => {
  const total = dayExercises(programDayFor(run.globalDay)).length;
  switch (step.kind) {
    case 'set': {
      const position = `Ejercicio ${step.exerciseIndex + 1} de ${total} · Serie ${step.setNumber} de ${SETS_PER_EXERCISE}`;
      return {
        progress: position,
        title: step.exercise.name,
        detail: [formatTarget(step.exercise), step.side && SIDE_LABELS[step.side]]
          .filter(Boolean)
          .join(' · '),
      };
    }
    case 'rest':
      return {
        progress: step.rest === 'set' ? 'Descanso entre series' : 'Descanso entre ejercicios',
        title: 'Descansa',
        detail: `Siguiente: ${step.nextLabel}`,
      };
    case 'cardio':
      return { progress: 'Paso final', title: 'Cardio', detail: `${step.minutes} minutos` };
  }
};

function TimedStep({ run, step, alerts }: TimedStepProps) {
  const now = useNow();
  const { timer, stepIndex } = run;
  const countdown = timer.durationMs !== null;
  const finished = isFinished(timer, now);
  const seconds = (countdown ? remainingMs(timer, now) : elapsedMs(timer, now)) / 1000;
  const displayed = countdown ? Math.ceil(seconds) : Math.floor(seconds);
  const paused = timer.runningSince === null;
  const heading = stepHeading(run, step);

  useEffect(() => {
    if (!finished) return;
    playAlert(alerts);
    advanceStep(stepIndex);
  }, [finished, stepIndex, alerts]);

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <p className="text-neutral-700 dark:text-neutral-300">{heading.progress}</p>
        <h1 className="text-3xl font-bold">{heading.title}</h1>
        <p className="text-lg">{heading.detail}</p>
      </div>
      <p aria-live="polite" className="sr-only">
        {`${heading.title}. ${heading.detail}.`}
        {countdown && displayed <= WARNING_SECONDS ? ` Quedan ${WARNING_SECONDS} segundos.` : ''}
      </p>
      <p
        role="timer"
        aria-label={countdown ? 'Tiempo restante' : 'Tiempo transcurrido'}
        className="flex flex-1 items-center justify-center text-7xl font-bold tabular-nums"
      >
        {formatClock(displayed)}
      </p>
      <StepActions step={step} stepIndex={stepIndex} paused={paused} />
    </section>
  );
}

interface StepActionsProps {
  step: TimedStepProps['step'];
  stepIndex: number;
  paused: boolean;
}

function StepActions({ step, stepIndex, paused }: StepActionsProps) {
  const advance = () => advanceStep(stepIndex);

  switch (step.kind) {
    case 'set':
      return (
        <Button className={actionClass} onClick={advance}>
          {targetSeconds(step.exercise) === null ? 'Serie completada' : 'Terminar antes'}
        </Button>
      );
    case 'rest':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="min-h-14 text-lg"
              aria-label="Restar 15 segundos"
              onClick={() => adjustRest(-REST_ADJUST_MS)}
            >
              −15 s
            </Button>
            <Button
              variant="secondary"
              className="min-h-14 text-lg"
              aria-label="Sumar 15 segundos"
              onClick={() => adjustRest(REST_ADJUST_MS)}
            >
              +15 s
            </Button>
          </div>
          <Button className={actionClass} onClick={advance}>
            Saltar descanso
          </Button>
        </>
      );
    case 'cardio':
      return (
        <>
          <Button variant="secondary" className="min-h-14 text-lg" onClick={togglePause}>
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button className={actionClass} onClick={advance}>
            Finalizar cardio
          </Button>
        </>
      );
  }
}
