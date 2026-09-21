// Genera src/environments/maps-key.ts a partir de GOOGLE_MAPS_API_KEY.
// Fuente de la key (en orden): variable de entorno -> frontend/.env.
// El archivo generado está en .gitignore: la key NUNCA se versiona.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const key = String(process.env.GOOGLE_MAPS_API_KEY || fileEnv.GOOGLE_MAPS_API_KEY || '').trim();
const escaped = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const target = resolve(root, 'src/environments/maps-key.ts');
const content =
  '// ARCHIVO GENERADO por scripts/generate-maps-key.mjs — NO editar ni commitear.\n' +
  '// La key se inyecta en build desde GOOGLE_MAPS_API_KEY (frontend/.env o variable de entorno).\n' +
  `export const GOOGLE_MAPS_API_KEY = '${escaped}';\n`;

writeFileSync(target, content, 'utf8');
console.log(
  `[maps-key] ${key ? 'key inyectada' : 'sin key (se compila vacío)'} -> src/environments/maps-key.ts`,
);
