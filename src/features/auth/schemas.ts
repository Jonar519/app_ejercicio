import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 10;
/** Límite de bcrypt, el algoritmo con el que Supabase Auth guarda las contraseñas. */
export const MAX_PASSWORD_LENGTH = 72;

const email = z.email('Introduce un email válido').max(254, 'El email es demasiado largo');

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, `Usa como máximo ${MAX_PASSWORD_LENGTH} caracteres`);

const passwordsMatch = {
  path: ['confirmation'],
  error: 'Las contraseñas no coinciden',
};

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Introduce tu contraseña'),
});

export const registerSchema = z
  .object({ email, password: newPassword, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, passwordsMatch);

export const recoverSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, passwordsMatch);

export const firstErrors = (error: z.ZodError) => {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      (messages as string[] | undefined)?.[0],
    ]),
  ) as Record<string, string | undefined>;
};
