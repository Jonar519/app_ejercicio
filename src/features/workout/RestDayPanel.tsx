import { useState } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { formatNumber } from '../../lib/format';
import { fromKg } from '../../lib/units';
import { useUserId } from '../auth/authStore';
import { useSettings } from '../profile/hooks';
import { useWeightLogs } from '../weigh-in/hooks';
import { WeighInForm } from '../weigh-in/WeighInForm';
import { useSetProgress } from './hooks';
import { programDayFor } from './plan';
import { finishRestDay } from './runnerStore';

interface RestDayPanelProps {
  globalDay: number;
}

export function RestDayPanel({ globalDay }: RestDayPanelProps) {
  const userId = useUserId();
  const setProgress = useSetProgress();
  const settings = useSettings();
  const weights = useWeightLogs();
  const [pending, setPending] = useState(false);
  const { requiresWeighIn } = programDayFor(globalDay);
  const unit = settings.data?.weight_unit ?? 'kg';
  const todayWeight = weights.data?.find((log) => log.global_day === globalDay);
  const blocked = requiresWeighIn && !todayWeight;

  const handleComplete = async () => {
    setPending(true);
    setProgress(await finishRestDay(userId, globalDay));
  };

  return (
    <>
      <p>Hoy toca recuperar. Tu cuerpo progresa mientras descansa:</p>
      <ul className="list-inside list-disc">
        <li>Movilidad suave durante unos minutos.</li>
        <li>Caminata ligera, si te apetece.</li>
        <li>Bebe agua a lo largo del día.</li>
        <li>Duerme bien esta noche.</li>
      </ul>
      {requiresWeighIn && !weights.isPending && !todayWeight && (
        <WeighInForm globalDay={globalDay} unit={unit} />
      )}
      {todayWeight && (
        <FormMessage kind="success">
          Peso registrado: {formatNumber(fromKg(todayWeight.weight_kg, unit))} {unit}
        </FormMessage>
      )}
      <Button
        className="min-h-14 text-lg"
        disabled={pending || blocked}
        aria-describedby={blocked ? 'weigh-in-required' : undefined}
        onClick={handleComplete}
      >
        Marcar descanso completado
      </Button>
      {blocked && (
        <p id="weigh-in-required" className="text-sm text-neutral-700 dark:text-neutral-300">
          Registra tu peso para poder cerrar el día.
        </p>
      )}
    </>
  );
}
