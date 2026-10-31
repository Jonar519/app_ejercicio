import { PartyPopper } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../../components/Button';
import { cycleDay, cycleNumber } from '../../lib/cycle';
import { dismissCelebration, type Celebration as CelebrationData } from './runnerStore';

const VISIBLE_MS = 4000;

interface CelebrationProps {
  celebration: CelebrationData;
}

export function Celebration({ celebration }: CelebrationProps) {
  const { globalDay, nextGlobalDay, completedCycle } = celebration;

  useEffect(() => {
    const timeout = setTimeout(dismissCelebration, VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section
      className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
      role="status"
    >
      <PartyPopper
        aria-hidden="true"
        size={64}
        className="text-emerald-700 dark:text-emerald-400"
      />
      <h1 className="text-3xl font-bold">¡Día {globalDay} completado!</h1>
      {completedCycle !== null && (
        <p className="text-lg font-semibold">
          ¡Felicidades, has completado el ciclo {completedCycle}!
        </p>
      )}
      <p>
        Siguiente: Día {nextGlobalDay} · Ciclo {cycleNumber(nextGlobalDay)} · Día{' '}
        {cycleDay(nextGlobalDay)} del programa
      </p>
      <Button onClick={dismissCelebration}>Continuar</Button>
    </section>
  );
}
