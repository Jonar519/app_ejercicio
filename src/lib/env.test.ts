import { EnvError, parseEnv } from './env';

const jwtWithRole = (role: string) => `aaa.${btoa(JSON.stringify({ role }))}.bbb`;

const validEnv = {
  VITE_SUPABASE_URL: 'https://ejemplo.supabase.co',
  VITE_SUPABASE_ANON_KEY: jwtWithRole('anon'),
};

describe('parseEnv', () => {
  it('acepta una configuración válida', () => {
    expect(parseEnv(validEnv)).toEqual(validEnv);
  });

  it('falla con un mensaje claro si faltan variables', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('rechaza una URL inválida', () => {
    expect(() => parseEnv({ ...validEnv, VITE_SUPABASE_URL: 'no-es-url' })).toThrow(EnvError);
    expect(() => parseEnv({ ...validEnv, VITE_SUPABASE_URL: 'ftp://x.supabase.co' })).toThrow(
      EnvError,
    );
  });

  it('rechaza claves secretas expuestas al cliente', () => {
    const secretKeys = [jwtWithRole('service_role'), 'sb_secret_ficticio'];
    for (const key of secretKeys) {
      expect(() => parseEnv({ ...validEnv, VITE_SUPABASE_ANON_KEY: key })).toThrow(/clave secreta/);
    }
  });
});
