import { z } from 'zod';
import type { QueueItem } from '../../lib/offline/queue';

export const MAX_FOOD_NAME_LENGTH = 120;
export const MAX_CALORIES = 20000;

export const foodLogSchema = z.object({
  id: z.uuid(),
  log_date: z.string(),
  name: z.string(),
  calories: z.number(),
});

export type FoodLog = z.infer<typeof foodLogSchema>;

/** Mismos límites que las restricciones de `food_logs`. */
export const foodInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre del alimento')
    .max(MAX_FOOD_NAME_LENGTH, `Usa como máximo ${MAX_FOOD_NAME_LENGTH} caracteres`),
  calories: z
    .number({ error: 'Introduce las calorías' })
    .int('Usa un número entero')
    .min(0, 'Las calorías no pueden ser negativas')
    .max(MAX_CALORIES, 'El máximo es 20 000'),
});

export type FoodInput = z.infer<typeof foodInputSchema>;

/** Aplica sobre los datos del servidor las operaciones pendientes de la fecha indicada. */
export const mergePendingFood = (logs: FoodLog[], queue: QueueItem[], date: string) => {
  const byId = new Map(logs.map((log) => [log.id, log]));
  for (const { operation, failed } of queue) {
    if (failed) continue;
    if (operation.type === 'food_delete') byId.delete(operation.id);
    if (operation.type !== 'food_upsert') continue;
    if (operation.logDate === date) {
      byId.set(operation.id, {
        id: operation.id,
        log_date: operation.logDate,
        name: operation.name,
        calories: operation.calories,
      });
    } else {
      byId.delete(operation.id);
    }
  }
  return [...byId.values()];
};

export const totalCalories = (logs: FoodLog[]) => logs.reduce((sum, log) => sum + log.calories, 0);
