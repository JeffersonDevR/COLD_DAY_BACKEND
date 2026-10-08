// Genera src/app/core/environment/api-base-url.ts a partir de API_BASE_URL.
// Fuente de la URL (en orden): variable de entorno -> frontend/.env -> '/api'.
//
// El default '/api' preserva el flujo de desarrollo: en `ng serve` esa ruta la
// resuelve proxy.conf.json contra el backend local (ver environment.ts). En
// produccion (Vercel) se define API_BASE_URL con la URL absoluta del backend,
// porque no existe proxy y '/api' apuntaria al propio hosting del front.
//
// El archivo generado esta en .gitignore: nunca se versiona.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const DEFAULT_BASE_URL = '/api';

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
const fromEnv = String(process.env.API_BASE_URL || fileEnv.API_BASE_URL || '').trim();
// readEnvFile ya quita comillas del .env, pero process.env las conserva si el
// valor se exporto con ellas (ej. PowerShell `$env:X = '"https://..."'`).
// Se normaliza en ambos casos para no generar una URL rota en silencio.
const raw = fromEnv.replace(/^(['"])(.*)\1$/, '$2').trim();

// api.config.ts concatena `${baseUrl}${path}` con path empezando en '/', asi que
// una barra final produciria '//'. Se normaliza para tolerar el error humano.
const normalized = raw.replace(/\/+$/, '');
const baseUrl = normalized || DEFAULT_BASE_URL;

if (raw && !/^https?:\/\//.test(normalized) && !normalized.startsWith('/')) {
  console.warn(
    `[api-url] API_BASE_URL="${raw}" no es absoluta (http/https) ni relativa ("/..."): revisala.`,
  );
}

const escaped = baseUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const target = resolve(root, 'src/app/core/environment/api-base-url.ts');
const content =
  '// ARCHIVO GENERADO por scripts/generate-api-url.mjs — NO editar ni commitear.\n' +
  '// La URL se inyecta en build desde API_BASE_URL (frontend/.env o variable de entorno).\n' +
  `export const API_BASE_URL = '${escaped}';\n`;

writeFileSync(target, content, 'utf8');
console.log(
  `[api-url] ${baseUrl === DEFAULT_BASE_URL && !raw ? 'default' : `"${baseUrl}"`} -> src/app/core/environment/api-base-url.ts`,
);
