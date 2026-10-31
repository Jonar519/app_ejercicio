import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUserId } from '../auth/authStore';
import { loadGlobalDay } from './api';
import { loadRun } from './runnerStore';

const TICK_MS = 250;

export const useProgress = () => {
  const userId = useUserId();
  return useQuery({ queryKey: ['progress', userId], queryFn: () => loadGlobalDay(userId) });
};

export const useSetProgress = () => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return (globalDay: number) => queryClient.setQueryData(['progress', userId], globalDay);
};

/** Carga el día en curso guardado cuando se conoce el día activo. */
export const useLoadRun = (globalDay: number | undefined) => {
  const userId = useUserId();
  useEffect(() => {
    if (globalDay !== undefined) void loadRun(userId, globalDay);
  }, [userId, globalDay]);
};

/** Hora actual refrescada para pintar; los temporizadores calculan siempre desde sus marcas. */
export const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = setInterval(refresh, TICK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return now;
};

/** Mantiene la pantalla encendida donde exista la API; el permiso se pierde al ocultar la página. */
export const useWakeLock = () => {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (released) await lock.release();
        else sentinel = lock;
      } catch {
        // Batería baja o sin permiso: el entrenamiento sigue sin el bloqueo.
      }
    };
    const handleVisibility = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void sentinel?.release();
    };
  }, []);
};
