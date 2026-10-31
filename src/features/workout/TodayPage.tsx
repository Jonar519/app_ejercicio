import { Scale } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { cycleDay, cycleNumber } from '../../lib/cycle';
import { useUserId } from '../auth/authStore';
import { useSettings } from '../profile/hooks';
import { Celebration } from './Celebration';
import { useLoadRun, useProgress } from './hooks';
import { dayExercises, dayTitle, formatTarget, programDayFor } from './plan';
import { RestDayPanel } from './RestDayPanel';
import { startRun, useRunnerStore } from './runnerStore';
import { unlockAudio } from './alerts';

export function TodayPage() {
  const progress = useProgress();
  const settings = useSettings();
  const celebration = useRunnerStore((state) => state.celebration);
  useLoadRun(progress.data);

  if (celebration) return <Celebration celebration={celebration} />;
  if (progress.isPending || settings.isPending) return <Loading />;
  if (!progress.data || !settings.data) {
    return (
      <>
        <FormMessage kind="error">
          No se pudo cargar tu entrenamiento. Comprueba tu conexión.
        </FormMessage>
        <Button
          variant="secondary"
          onClick={() => {
            void progress.refetch();
            void settings.refetch();
          }}
        >
          Reintentar
        </Button>
      </>
    );
  }

  const globalDay = progress.data;
  const day = programDayFor(globalDay);

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold">Día {globalDay}</h1>
        <p className="text-neutral-700 dark:text-neutral-300">
          Ciclo {cycleNumber(globalDay)} · Día {cycleDay(globalDay)} del programa
        </p>
      </header>
      <section className="flex flex-col gap-3" aria-labelledby="today-title">
        <h2 id="today-title" className="text-2xl font-semibold">
          {dayTitle(day)}
        </h2>
        {day.type === 'active_rest' ? (
          <RestDayPanel globalDay={globalDay} />
        ) : (
          <TrainingPanel
            globalDay={globalDay}
            restBetweenSets={settings.data.rest_between_sets_seconds}
            restBetweenExercises={settings.data.rest_between_exercises_seconds}
          />
        )}
      </section>
      <Link to="/entrenamiento/peso" className="link-action gap-2">
        <Scale aria-hidden="true" size={20} />
        Historial de peso
      </Link>
    </>
  );
}

interface TrainingPanelProps {
  globalDay: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

function TrainingPanel({ globalDay, restBetweenSets, restBetweenExercises }: TrainingPanelProps) {
  const userId = useUserId();
  const navigate = useNavigate();
  const inProgress = useRunnerStore((state) => state.run?.globalDay === globalDay);
  const ready = useRunnerStore((state) => state.ready);
  const [starting, setStarting] = useState(false);
  const day = programDayFor(globalDay);
  const exercises = dayExercises(day);

  const handleStart = async () => {
    unlockAudio();
    setStarting(true);
    await startRun(userId, globalDay, {
      betweenSets: restBetweenSets,
      betweenExercises: restBetweenExercises,
    });
    navigate('/entrenamiento/sesion');
  };

  return (
    <>
      {exercises.length > 0 && (
        <>
          <p>3 series de cada ejercicio:</p>
          <ol className="flex flex-col gap-1">
            {exercises.map((exercise) => (
              <li
                key={exercise.key}
                className="flex justify-between gap-3 rounded-lg bg-white p-3 dark:bg-neutral-800"
              >
                <span>{exercise.name}</span>
                <span className="text-right text-neutral-700 dark:text-neutral-300">
                  {formatTarget(exercise)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {day.cardioMinutes !== undefined && (
        <p>
          {exercises.length > 0 ? 'Al final: ' : ''}
          {day.cardioMinutes} minutos de cardio libre.
        </p>
      )}
      <Button className="min-h-14 text-lg" disabled={!ready || starting} onClick={handleStart}>
        {inProgress ? 'Continuar' : 'Comenzar'}
      </Button>
    </>
  );
}
