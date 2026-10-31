import { z } from 'zod';
import { cycleDay, cycleNumber } from '../../lib/cycle';
import type { QueueItem } from '../../lib/offline/queue';
import {
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  fromKg,
  isValidWeightKg,
  toKg,
  type WeightUnit,
} from '../../lib/units';

export const weightLogSchema = z.object({
  id: z.uuid(),
  global_day: z.number(),
  cycle_day: z.number(),
  cycle_number: z.number(),
  weight_kg: z.coerce.number(),
  logged_at: z.string(),
});

export type WeightLog = z.infer<typeof weightLogSchema>;

export interface WeightEntry extends WeightLog {
  /** Diferencia en kg con el registro anterior; null en el primero. */
  deltaKg: number | null;
}

type WeightInput = { kg: number; error?: undefined } | { kg?: undefined; error: string };

/** Acepta coma decimal y valida contra el rango en kg, que es lo que se almacena. */
export const parseWeightInput = (raw: string, unit: WeightUnit): WeightInput => {
  const value = Number(raw.trim().replace(',', '.'));
  if (raw.trim() === '' || !Number.isFinite(value)) return { error: 'Introduce tu peso' };
  const kg = toKg(value, unit);
  if (!isValidWeightKg(kg)) {
    return {
      error: `Introduce un peso entre ${fromKg(MIN_WEIGHT_KG, unit)} y ${fromKg(MAX_WEIGHT_KG, unit)} ${unit}`,
    };
  }
  return { kg };
};

/** Superpone los pesos aún no sincronizados; ordena de más antiguo a más reciente. */
export const mergePendingWeights = (logs: WeightLog[], queue: QueueItem[]) => {
  const byDay = new Map(logs.map((log) => [log.global_day, log]));
  for (const { operation, failed } of queue) {
    if (operation.type !== 'weight_log' || failed) continue;
    byDay.set(operation.globalDay, {
      id: operation.id,
      global_day: operation.globalDay,
      cycle_day: cycleDay(operation.globalDay),
      cycle_number: cycleNumber(operation.globalDay),
      weight_kg: operation.weightKg,
      logged_at: operation.loggedAt,
    });
  }
  return [...byDay.values()].sort((a, b) => a.global_day - b.global_day);
};

export const withVariation = (logs: WeightLog[]): WeightEntry[] =>
  logs.map((log, index) => {
    const previous = logs[index - 1];
    return {
      ...log,
      deltaKg: previous ? Math.round((log.weight_kg - previous.weight_kg) * 100) / 100 : null,
    };
  });
