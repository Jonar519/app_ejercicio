import { z } from 'zod';

const jwtRole = (token: string): unknown => {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const parsed: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return z.object({ role: z.unknown() }).safeParse(parsed).data?.role;
  } catch {
    return undefined;
  }
};

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: 'VITE_SUPABASE_URL debe ser una URL http(s) válida',
  }),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: 'Falta VITE_SUPABASE_ANON_KEY' })
    .min(1, 'Falta VITE_SUPABASE_ANON_KEY')
    .refine((key) => !key.startsWith('sb_secret_') && jwtRole(key) !== 'service_role', {
      error: 'VITE_SUPABASE_ANON_KEY no puede ser una clave secreta: usa la clave anon pública',
    }),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Configuración inválida: ${issues.join('; ')}`);
    this.name = 'EnvError';
  }
}

export const parseEnv = (source: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) throw new EnvError(result.error.issues.map((issue) => issue.message));
  return result.data;
};
