import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { formatClock } from '../../lib/format';
import { useSetProgress } from './hooks';
import { summarizeRun, type Run } from './run';
import { finishDay } from './runnerStore';

interface SummaryStepProps {
  run: Run;
}

const rowClass = 'flex justify-between gap-3 rounded-lg bg-white p-3 dark:bg-neutral-800';

export function SummaryStep({ run }: SummaryStepProps) {
  const navigate = useNavigate();
  const setProgress = useSetProgress();
  const [pending, setPending] = useState(false);
  const summary = summarizeRun(run);

  const handleFinish = async () => {
    setPending(true);
    const nextGlobalDay = await finishDay();
    if (nextGlobalDay !== null) setProgress(nextGlobalDay);
    navigate('/entrenamiento', { replace: true });
  };

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">Resumen del día {run.globalDay}</h1>
        <p className="text-lg">
          Tiempo total:{' '}
          <span className="font-semibold tabular-nums">{formatClock(summary.totalSeconds)}</span>
        </p>
      </div>
      <ul className="flex flex-1 flex-col gap-1">
        {summary.exercises.map((exercise) => (
          <li key={exercise.key} className={rowClass}>
            <span>{exercise.name}</span>
            <span className="tabular-nums">{formatClock(exercise.seconds)}</span>
          </li>
        ))}
        {summary.cardioSeconds !== null && (
          <li className={rowClass}>
            <span>Cardio</span>
            <span className="tabular-nums">{formatClock(summary.cardioSeconds)}</span>
          </li>
        )}
      </ul>
      <Button className="min-h-20 w-full text-xl" disabled={pending} onClick={handleFinish}>
        Finalizar día
      </Button>
    </section>
  );
}
