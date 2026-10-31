import { useState } from 'react';
import { Button } from '../../components/Button';
import { useUserId } from '../auth/authStore';
import { useSetProgress } from './hooks';
import { finishRestDay } from './runnerStore';

interface RestDayPanelProps {
  globalDay: number;
}

export function RestDayPanel({ globalDay }: RestDayPanelProps) {
  const userId = useUserId();
  const setProgress = useSetProgress();
  const [pending, setPending] = useState(false);

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
      <Button className="min-h-14 text-lg" disabled={pending} onClick={handleComplete}>
        Marcar descanso completado
      </Button>
    </>
  );
}
