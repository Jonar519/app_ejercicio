import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { startSync } from '../../lib/offline/sync';
import { useUserId } from '../auth/authStore';

/** Mantiene activa la cola offline en todas las pantallas con sesión. */
export function SyncBoundary() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  useEffect(
    () => startSync(userId, () => void queryClient.invalidateQueries()),
    [userId, queryClient],
  );

  return <Outlet />;
}
