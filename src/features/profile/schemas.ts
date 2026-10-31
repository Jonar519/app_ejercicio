import { z } from 'zod';

export const MAX_DISPLAY_NAME_LENGTH = 50;

export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .max(MAX_DISPLAY_NAME_LENGTH, `Usa como máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres`);

const restSeconds = (label: string) =>
  z
    .number({ error: `${label}: introduce un número` })
    .int(`${label}: usa un número entero`)
    .min(5, `${label}: mínimo 5 segundos`)
    .max(600, `${label}: máximo 600 segundos`);

/** Mismos límites que las restricciones de `user_settings`. */
export const settingsSchema = z.object({
  weight_unit: z.enum(['kg', 'lb']),
  daily_calorie_goal: z
    .number({ error: 'Introduce un número' })
    .int('Usa un número entero')
    .min(1, 'La meta debe ser mayor que 0')
    .max(20000, 'La meta máxima es 20 000'),
  rest_between_sets_seconds: restSeconds('Descanso entre series'),
  rest_between_exercises_seconds: restSeconds('Descanso entre ejercicios'),
  sound_enabled: z.boolean(),
  vibration_enabled: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const exportSchema = z.looseObject({
  profile: z.looseObject({ id: z.uuid() }),
  settings: z.looseObject({}),
  progress: z.looseObject({ global_day: z.number() }),
  workout_sessions: z.array(z.unknown()),
  exercise_logs: z.array(z.unknown()),
  cardio_logs: z.array(z.unknown()),
  weight_logs: z.array(z.unknown()),
  food_logs: z.array(z.unknown()),
});
