import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { cachedRead } from '../../lib/offline/cachedRead';
import { isNetworkFailure } from '../../lib/offline/errors';
import { readQueue } from '../../lib/offline/queue';
import { enqueueOperation } from '../../lib/offline/sync';
import { supabase } from '../../lib/supabase';
import { useUserId } from '../auth/authStore';
import { foodLogSchema, mergePendingFood, type FoodInput, type FoodLog } from './food';

const fetchFoodLogs = async (userId: string, date: string) => {
  const { data, error } = await supabase
    .from('food_logs')
    .select('id, log_date, name, calories')
    .eq('user_id', userId)
    .eq('log_date', date)
    .order('created_at');
  if (error) throw error;
  return z.array(foodLogSchema).parse(data);
};

const loadFoodLogs = async (userId: string, date: string) => {
  const logs = await cachedRead<FoodLog[]>(userId, `food:${date}`, () =>
    fetchFoodLogs(userId, date),
  ).catch((error: unknown) => {
    if (isNetworkFailure(error)) return [];
    throw error;
  });
  return mergePendingFood(logs, await readQueue(userId), date);
};

export const useFoodLogs = (date: string) => {
  const userId = useUserId();
  return useQuery({
    queryKey: ['food', userId, date],
    queryFn: () => loadFoodLogs(userId, date),
  });
};

const useFoodMutation = <T>(mutationFn: (userId: string, input: T) => Promise<void>) => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => mutationFn(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['food', userId] }),
  });
};

/** Sin `id` crea el alimento; el UUID del cliente hace idempotente el envío. */
export const useSaveFood = (date: string) =>
  useFoodMutation((userId, { id, ...food }: FoodInput & { id?: string }) =>
    enqueueOperation(userId, {
      type: 'food_upsert',
      id: id ?? crypto.randomUUID(),
      logDate: date,
      ...food,
    }),
  );

export const useDeleteFood = () =>
  useFoodMutation((userId, id: string) => enqueueOperation(userId, { type: 'food_delete', id }));
