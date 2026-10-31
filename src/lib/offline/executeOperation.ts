import { supabase } from '../supabase';
import { RemoteError } from './errors';
import type { SyncOperation } from './queue';

interface RemoteResponse {
  error: { message: string } | null;
  status: number;
}

const assertOk = ({ error, status }: RemoteResponse) => {
  if (error) throw new RemoteError(error.message, status);
};

export const executeOperation = async (operation: SyncOperation) => {
  switch (operation.type) {
    case 'session_start':
      return assertOk(
        await supabase.rpc('sync_start_session', {
          p_id: operation.id,
          p_global_day: operation.globalDay,
          p_started_at: operation.startedAt,
        }),
      );
    case 'exercise_log':
      return assertOk(
        await supabase.rpc('sync_exercise_log', {
          p_global_day: operation.globalDay,
          p_exercise_key: operation.exerciseKey,
          p_set_number: operation.setNumber,
          p_side: operation.side,
          p_target: operation.target,
          p_duration_seconds: operation.durationSeconds,
          p_completed_at: operation.completedAt,
        }),
      );
    case 'cardio_log':
      return assertOk(
        await supabase.rpc('sync_cardio_log', {
          p_global_day: operation.globalDay,
          p_target_minutes: operation.targetMinutes,
          p_actual_seconds: operation.actualSeconds,
          p_completed_at: operation.completedAt,
        }),
      );
    case 'weight_log':
      return assertOk(
        await supabase.rpc('sync_weight_log', {
          p_id: operation.id,
          p_global_day: operation.globalDay,
          p_weight_kg: operation.weightKg,
          p_logged_at: operation.loggedAt,
        }),
      );
    case 'food_upsert':
      return assertOk(
        await supabase.rpc('sync_food_log', {
          p_id: operation.id,
          p_log_date: operation.logDate,
          p_name: operation.name,
          p_calories: operation.calories,
        }),
      );
    case 'food_delete':
      return assertOk(await supabase.from('food_logs').delete().eq('id', operation.id));
    case 'complete_day':
      return assertOk(await supabase.rpc('complete_day', { p_global_day: operation.globalDay }));
  }
};
