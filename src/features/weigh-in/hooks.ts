import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { cachedRead } from '../../lib/offline/cachedRead';
import { isNetworkFailure } from '../../lib/offline/errors';
import { readQueue } from '../../lib/offline/queue';
import { enqueueOperation } from '../../lib/offline/sync';
import { supabase } from '../../lib/supabase';
import { useUserId } from '../auth/authStore';
import { mergePendingWeights, weightLogSchema, type WeightLog } from './weight';

const fetchWeightLogs = async (userId: string) => {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id, global_day, cycle_day, cycle_number, weight_kg, logged_at')
    .eq('user_id', userId)
    .order('global_day');
  if (error) throw error;
  return z.array(weightLogSchema).parse(data);
};

/** Sin conexión ni copia local el historial empieza vacío: la cola sigue siendo visible. */
const loadWeightLogs = async (userId: string) => {
  const logs = await cachedRead<WeightLog[]>(userId, 'weight', () => fetchWeightLogs(userId)).catch(
    (error: unknown) => {
      if (isNetworkFailure(error)) return [];
      throw error;
    },
  );
  return mergePendingWeights(logs, await readQueue(userId));
};

export const useWeightLogs = () => {
  const userId = useUserId();
  return useQuery({ queryKey: ['weight', userId], queryFn: () => loadWeightLogs(userId) });
};

export const useLogWeight = (globalDay: number) => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weightKg: number) =>
      enqueueOperation(userId, {
        type: 'weight_log',
        id: crypto.randomUUID(),
        globalDay,
        weightKg,
        loggedAt: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weight', userId] }),
  });
};
