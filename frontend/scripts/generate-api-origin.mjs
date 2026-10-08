// Genera src/app/core/environment/api-origin.ts a partir de API_ORIGIN.
// Fuente del valor (en orden): variable de entorno -> frontend/.env -> ''.
//
// API_ORIGIN contiene SOLO el origen del backend (host, sin path). El prefijo
// '/api' y la version de la API NO viven aca: viven en el codigo
// (src/app/core/service/api.config.ts). Asi una env var mal escrita no puede
// volver a mover el prefijo en silencio.
//
// El default '' preserva el flujo de desarrollo: en `ng serve` url('/x') queda
// relativo ('/api/x') y lo resuelve proxy.conf.json contra el backend local. En
// produccion (Vercel) se define API_ORIGIN con el host absoluto del backend,
// porque no existe proxy y '/api' apuntaria al propio hosting del front.
//
// El archivo generado esta en .gitignore: nunca se versiona.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const DEFAULT_ORIGIN = '';

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
const fromEnv = String(process.env.API_ORIGIN || fileEnv.API_ORIGIN || '').trim();
// readEnvFile ya quita comillas del .env, pero process.env las conserva si el
// valor se exporto con ellas (ej. PowerShell `$env:X = '"https://..."'`).
// Se normaliza en ambos casos para no generar una URL rota en silencio.
const raw = fromEnv.replace(/^(['"])(.*)\1$/, '$2').trim();

// API_BASE_URL quedo deprecada: antes llevaba el prefijo /api embebido en el
// valor; ahora el prefijo lo agrega el codigo. Si el renombre quedo a medias y
// caemos al default vacio, todas las llamadas salen relativas ('/api/...')
// contra el hosting del front y dan 404. Mejor cortar el build y decirlo.
const legacy = String(process.env.API_BASE_URL || fileEnv.API_BASE_URL || '')
  .trim()
  .replace(/^(['"])(.*)\1$/, '$2')
  .trim();
if (legacy) {
  if (raw) {
    console.warn(
      `[api-origin] AVISO: API_BASE_URL="${legacy}" esta deprecada y se ignora. Podes borrarla.`,
    );
  } else {
    console.error(
      `[api-origin] ERROR: API_BASE_URL="${legacy}" esta deprecada y API_ORIGIN no esta definida.\n` +
        'La variable se renombro a API_ORIGIN y ahora debe contener SOLO el origen,\n' +
        "sin path y sin '/api' (el prefijo lo agrega el codigo).\n" +
        'Ejemplo valido: API_ORIGIN=https://cold-day-backend.onrender.com',
    );
    process.exit(1);
  }
}

// api.config.ts concatena `${origin}${API_PREFIX}${path}`, asi que una barra
// final produciria '//api'. Se normaliza para tolerar el error humano.
const origin = raw.replace(/\/+$/, '');

// Validacion ruidosa: si hay valor pero no es un origen puro, cortar el build.
if (origin) {
  let parsed = null;
  try {
    parsed = new URL(origin);
  } catch {
    parsed = null;
  }
  const isHttp = parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  const isBareOrigin = parsed && parsed.pathname === '/';
  if (!isHttp || !isBareOrigin) {
    console.error(
      `[api-origin] ERROR: API_ORIGIN="${raw}" no es valido.\n` +
        "API_ORIGIN debe contener SOLO el origen (host), sin path y sin '/api'.\n" +
        "El prefijo '/api' y la version los agrega el codigo (api.config.ts).\n" +
        'Ejemplo valido: https://cold-day-backend.onrender.com',
    );
    process.exit(1);
  }
}

const value = origin || DEFAULT_ORIGIN;

const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const target = resolve(root, 'src/app/core/environment/api-origin.ts');
const content =
  '// ARCHIVO GENERADO por scripts/generate-api-origin.mjs — NO editar ni commitear.\n' +
  '// El valor se inyecta en build desde API_ORIGIN (frontend/.env o variable de entorno).\n' +
  `export const API_ORIGIN = '${escaped}';\n`;

writeFileSync(target, content, 'utf8');
console.log(
  `[api-origin] ${value ? `"${value}"` : 'default (vacio)'} -> src/app/core/environment/api-origin.ts`,
);
