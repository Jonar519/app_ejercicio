// Aplica las migraciones en un Postgres de Supabase desechable y ejecuta las pruebas pgTAP.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const IMAGE = 'supabase/postgres:17.6.1.064';
const CONTAINER = `app-ejercicio-test-db-${randomBytes(4).toString('hex')}`;
const PASSWORD = randomBytes(16).toString('hex');

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

const sqlFile = (user, path) => {
  const result = docker(
    'exec',
    '-e',
    `PGPASSWORD=${PASSWORD}`,
    CONTAINER,
    'psql',
    '-h',
    '127.0.0.1',
    '-U',
    user,
    '-d',
    'postgres',
    '-X',
    '-q',
    '-t',
    '-A',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    path,
  );
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
};

const waitForDatabase = () => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const probe = docker(
      'exec',
      '-e',
      `PGPASSWORD=${PASSWORD}`,
      CONTAINER,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-tAc',
      'select 1',
    );
    if (probe.stdout?.trim() === '1') return;
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)']);
  }
  throw new Error('La base de datos no arrancó a tiempo');
};

const applyOrFail = (user, path) => {
  const { ok, output } = sqlFile(user, path);
  if (!ok) throw new Error(`Falló ${path}:\n${output}`);
};

const run = () => {
  const start = docker(
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    `POSTGRES_PASSWORD=${PASSWORD}`,
    IMAGE,
  );
  if (start.status !== 0) throw new Error(`No se pudo iniciar Docker:\n${start.stderr}`);
  waitForDatabase();

  docker('exec', CONTAINER, 'mkdir', '-p', '/work');
  docker('cp', 'supabase/.', `${CONTAINER}:/work/supabase`);
  docker('cp', 'scripts/test-db-bootstrap.sql', `${CONTAINER}:/work/bootstrap.sql`);

  applyOrFail('supabase_admin', '/work/bootstrap.sql');
  for (const migration of readdirSync('supabase/migrations').sort()) {
    applyOrFail('postgres', `/work/supabase/migrations/${migration}`);
    console.log(`migración aplicada: ${migration}`);
  }

  let failed = false;
  for (const test of readdirSync('supabase/tests').sort()) {
    const { ok, output } = sqlFile('postgres', `/work/supabase/tests/${test}`);
    const lines = output.split('\n');
    const failures = lines.filter((line) => /^not ok|^# (Failed|Looks like)|ERROR/.test(line));
    const passed = lines.filter((line) => /^ok /.test(line)).length;
    console.log(`${test}: ${passed} correctas, ${failures.length} problemas`);
    if (!ok || failures.length > 0) {
      failed = true;
      console.error(output);
    }
  }
  if (failed) process.exitCode = 1;
};

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  docker('rm', '-f', CONTAINER);
}
