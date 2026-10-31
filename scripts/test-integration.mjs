// Ejecuta las pruebas de integración contra el stack local de Supabase (`supabase start`).
// Las claves son las de demostración del stack local: no se imprimen ni se guardan.
import { spawnSync } from 'node:child_process';

const SUPABASE = 'npx -y supabase@2.122.0';

const status = spawnSync(`${SUPABASE} status -o env`, { shell: true, encoding: 'utf8' });
const values = Object.fromEntries(
  [...status.stdout.matchAll(/^(\w+)="?([^"\r\n]*)"?\r?$/gm)].map(([, key, value]) => [key, value]),
);

if (!values.API_URL || !values.ANON_KEY) {
  console.error(`El stack local no está activo. Ejecuta: ${SUPABASE} start`);
  process.exit(1);
}

const tests = spawnSync('npx vitest run --config vitest.integration.config.ts', {
  shell: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: values.API_URL,
    VITE_SUPABASE_ANON_KEY: values.ANON_KEY,
  },
});
process.exitCode = tests.status ?? 1;
