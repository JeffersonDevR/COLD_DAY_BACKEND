// Genera cobertura (ng test --coverage) y ejecuta el SonarScanner de npm (@sonar/scan).
// Fuente del token (en orden): variable de entorno -> frontend/.env.
// El resto de la configuracion vive en sonar-project.properties.
// Uso: npm run sonar
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}

const fileEnv = readEnvFile(resolve(root, '.env'));
const token = String(process.env.SONAR_TOKEN || fileEnv.SONAR_TOKEN || '').trim();

if (!token) {
  console.error('[sonar] Falta SONAR_TOKEN: definelo en frontend/.env o como variable de entorno.');
  process.exit(1);
}

const tests = spawnSync('ng', ['test', '--coverage', '--watch=false'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if ((tests.status ?? 1) !== 0) {
  console.error('[sonar] Los tests fallaron; se cancela el analisis.');
  process.exit(tests.status ?? 1);
}

const result = spawnSync('sonar-scanner-npm', [], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SONAR_TOKEN: token },
});

process.exit(result.status ?? 1);
