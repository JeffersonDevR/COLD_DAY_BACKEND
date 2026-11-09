// Genera projects/mobile/src/app/core/environment/mobile-origin.ts a partir de
// MOBILE_API_ORIGIN (variable de entorno o frontend/.env).
//
// Por qué un archivo aparte del web: la app móvil NO tiene proxy, así que su
// origen tiene que ser absoluto; la web en desarrollo usa rutas relativas y las
// resuelve proxy.conf.json. Si compartieran el archivo generado, compilar el
// móvil dejaría el web apuntando al backend de producción y sus tests (que
// esperan '/api/...') fallarían. Cada proyecto lee su propio archivo.
//
// El archivo generado está en .gitignore: nunca se versiona.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const fileEnv = readEnvFile(resolve(root, '.env'));
const raw = String(process.env.MOBILE_API_ORIGIN || fileEnv.MOBILE_API_ORIGIN || '').trim();
// Un punto final ("…railway.app.") es un host DISTINTO para el cliente HTTP: es
// el error de copiar la URL desde una frase. Se recorta junto con las barras.
const origin = raw.replace(/^(['"])(.*)\1$/, '$2').replace(/[./]+$/, '').trim();

if (origin) {
  let parsed = null;
  try {
    parsed = new URL(origin);
  } catch {
    parsed = null;
  }
  const esHttp = parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  const esSoloOrigen = parsed && parsed.pathname === '/';
  if (!esHttp || !esSoloOrigen) {
    console.error(
      `[mobile-origin] ERROR: MOBILE_API_ORIGIN="${raw}" no es valido.\n` +
        "Debe ser SOLO el origen (host), sin path y sin '/api'.\n" +
        'Ejemplo: MOBILE_API_ORIGIN=https://colddaybackend-production.up.railway.app',
    );
    process.exit(1);
  }
} else {
  console.warn(
    '[mobile-origin] AVISO: MOBILE_API_ORIGIN vacia. El build movil compilara una app ' +
      'que no puede hablar con el backend (el arranque lo muestra en pantalla).',
  );
}

const escaped = origin.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const target = resolve(root, 'projects/mobile/src/app/core/environment/mobile-origin.ts');
mkdirSync(dirname(target), { recursive: true });
const content =
  '// ARCHIVO GENERADO por scripts/generate-mobile-origin.mjs — NO editar ni commitear.\n' +
  '// Origen absoluto del backend para la app movil (sin proxy disponible).\n' +
  `export const MOBILE_API_ORIGIN = '${escaped}';\n`;

writeFileSync(target, content, 'utf8');
console.log(`[mobile-origin] ${origin ? 'inyectado' : 'vacío'} -> ${target}`);
