// Comprueba que el hook (secretlint) y CI (gitleaks) detectan un JWT con role service_role.
// El JWT se genera al ejecutarse, en un directorio temporal fuera del repositorio.
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const syntheticServiceRoleJwt = () => {
  const claims = {
    iss: 'supabase',
    ref: randomBytes(10).toString('hex'),
    role: 'service_role',
    iat: 1760000000,
    exp: 2075000000,
  };
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const signature = createHmac('sha256', randomBytes(32)).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

const hookCommand = JSON.parse(readFileSync('.lintstagedrc.json', 'utf8'))['*'][0];
const gitleaksImage = readFileSync('.github/workflows/ci.yml', 'utf8').match(
  /ghcr\.io\/gitleaks\/gitleaks:\S+/,
)[0];

const secretlint = (file) =>
  spawnSync(`npx ${hookCommand} "${file}"`, { shell: true, encoding: 'utf8' }).status;

// Mismo comando que CI: escanea el historial de un repositorio Git.
const gitleaks = (directory) => {
  const git = (...args) =>
    spawnSync(
      'git',
      [
        '-C',
        directory,
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@test.local',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { encoding: 'utf8' },
    );
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'prueba');
  return spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${directory}:/repo`,
      gitleaksImage,
      'git',
      '/repo',
      '--redact',
      '--no-banner',
    ],
    { encoding: 'utf8' },
  ).status;
};

const scenarios = [
  { name: 'JWT service_role', content: `KEY=${syntheticServiceRoleJwt()}\n`, expected: 1 },
  { name: 'control sin secretos', content: 'VITE_SUPABASE_URL=https://ejemplo\n', expected: 0 },
];

let failed = false;
for (const { name, content, expected } of scenarios) {
  const directory = mkdtempSync(join(tmpdir(), 'app-ejercicio-secretos-'));
  try {
    const file = join(directory, 'prueba.txt');
    writeFileSync(file, content);
    const results = { secretlint: secretlint(file), gitleaks: gitleaks(directory) };
    for (const [tool, status] of Object.entries(results)) {
      const ok = status === expected;
      failed ||= !ok;
      console.log(
        `${ok ? 'ok' : 'FALLO'} - ${tool} / ${name}: salida ${status}, esperada ${expected}`,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
if (failed) process.exitCode = 1;
