// Guardia ejecutable de las reglas del backend (ver ../../docs/backend/GUIA-BACKEND.md).
//
// Misma mecánica que frontend/scripts/check-ui-rules.mjs: cuenta infracciones en
// el código real y las compara con un techo (backend-rules.baseline.json) que
// SOLO BAJA. Si una regla sube, exit 1 y lista los primeros infractores.
// No sustituye a `./gradlew build`; lo complementa con lo que los tests no ven.
//
//   node scripts/check-backend-rules.mjs            verifica
//   node scripts/check-backend-rules.mjs --update   baja el techo a lo medido (solo si bajó)
//   node scripts/check-backend-rules.mjs --verbose  muestra todos los infractores
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = dirname(fileURLToPath(import.meta.url));
const raíz = resolve(aquí, '..');
const MAIN = join(raíz, 'src', 'main', 'java');
const RES = join(raíz, 'src', 'main', 'resources');
const BASELINE = join(aquí, 'backend-rules.baseline.json');
const VERBOSE = process.argv.includes('--verbose');
const UPDATE = process.argv.includes('--update');

function* recorrer(dir, ext) {
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta, ext);
    else if (ext.some((e) => n.endsWith(e))) yield ruta;
  }
}
const rel = (p) => relative(raíz, p).split(sep).join('/');
const enAplicacion = (p) => rel(p).includes('/application/');
const enApi = (p) => rel(p).includes('/infrastructure/api/');

/** `detectar(linea, archivo, lineasDelArchivo, i)` → boolean. */
const REGLAS = [
  {
    id: 'BE-P1',
    desc: 'lectura sin paginar en casos de uso (findAll/listarTodas)',
    archivos: 'java',
    detectar: (l, f) => enAplicacion(f) && /\b(findAll|listarTodas|findByActivoTrue)\s*\(\s*\)/.test(l),
  },
  {
    id: 'BE-E1',
    desc: 'getMessage() de excepción devuelto desde la capa API (filtra internos)',
    archivos: 'java',
    detectar: (l, f) => enApi(f) && /\b(ex|e|exception|err)\.getMessage\(\)/.test(l),
  },
  {
    id: 'BE-J1',
    desc: '@Scheduled sin @SchedulerLock (corre duplicado con 2 instancias)',
    archivos: 'java',
    detectar: (l, f, ls, i) =>
      /@Scheduled\(/.test(l) && !ls.slice(Math.max(0, i - 3), i + 3).some((x) => /@SchedulerLock/.test(x)),
  },
  {
    id: 'BE-X1',
    desc: 'System.out / printStackTrace en código de producción',
    archivos: 'java',
    detectar: (l) => /System\.(out|err)\.print|\.printStackTrace\(\)/.test(l),
  },
  {
    id: 'BE-S1',
    desc: 'secreto literal en código (password/secret/token = "…")',
    archivos: 'java',
    detectar: (l) => /\b(password|secret|apiKey|token)\s*=\s*"[^"{$]{6,}"/i.test(l) && !/@Value|demo|test|ejemplo/i.test(l),
  },
  {
    id: 'BE-S2',
    desc: 'endpoint sin @PreAuthorize cercano (revisar autorización por rol)',
    archivos: 'java',
    detectar: (l, f, ls, i) =>
      enApi(f) &&
      /@(Get|Post|Put|Patch|Delete)Mapping/.test(l) &&
      !ls.slice(Math.max(0, i - 4), i + 4).some((x) => /@PreAuthorize|@PermitAll/.test(x)) &&
      !ls.slice(0, 40).some((x) => /@PreAuthorize/.test(x)),
  },
  {
    id: 'BE-C1',
    desc: 'CORS abierto (allowedOrigins "*")',
    archivos: 'any',
    detectar: (l) => /allowedOrigins?\(?\s*[="(]\s*"\*"|allowed-origins\s*=\s*\*/.test(l),
  },
  {
    id: 'BE-D1',
    desc: 'ddl-auto distinto de validate/none (el esquema lo gobierna Flyway)',
    archivos: 'props',
    detectar: (l) => /ddl-auto\s*=\s*(create|create-drop|update)/.test(l),
  },
];

const medido = Object.fromEntries(REGLAS.map((r) => [r.id, { cuenta: 0, ejemplos: [] }]));
const javas = [...recorrer(MAIN, ['.java'])];
const props = existsSync(RES) ? [...recorrer(RES, ['.properties', '.yml', '.yaml'])] : [];

for (const regla of REGLAS) {
  const lista = regla.archivos === 'java' ? javas : regla.archivos === 'props' ? props : [...javas, ...props];
  for (const archivo of lista) {
    const ls = readFileSync(archivo, 'utf8').split(/\r?\n/);
    ls.forEach((texto, i) => {
      if (/^\s*(\/\/|\*|\/\*|#)/.test(texto)) return; // comentarios (java y .properties)
      if (regla.detectar(texto, archivo, ls, i)) {
        const m = medido[regla.id];
        m.cuenta += 1;
        if (VERBOSE || m.ejemplos.length < 5) m.ejemplos.push(`${rel(archivo)}:${i + 1}  ${texto.trim().slice(0, 90)}`);
      }
    });
  }
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
const nuevo = {};
let fallos = 0;
let bajaron = 0;
console.log(`${'regla'.padEnd(7)} ${'ahora'.padEnd(6)} ${'techo'.padEnd(6)} estado`);
for (const r of REGLAS) {
  const { cuenta, ejemplos } = medido[r.id];
  const techo = base?.[r.id];
  nuevo[r.id] = techo === undefined ? cuenta : Math.min(techo, cuenta);
  let estado = 'ok';
  if (techo === undefined) estado = base ? 'regla nueva' : 'sin baseline';
  else if (cuenta > techo) {
    estado = 'SUBIÓ';
    fallos += 1;
  } else if (cuenta < techo) {
    estado = 'bajó';
    bajaron += 1;
  }
  console.log(`${r.id.padEnd(7)} ${String(cuenta).padEnd(6)} ${String(techo ?? '-').padEnd(6)} ${estado}  ${r.desc}`);
  if (estado === 'SUBIÓ') for (const e of ejemplos) console.log(`    ${e}`);
}
if (UPDATE || !base) {
  writeFileSync(BASELINE, JSON.stringify(nuevo, null, 2) + '\n');
  console.log(`\nbaseline ${base ? 'actualizado' : 'creado'}: ${rel(BASELINE)}`);
} else if (bajaron > 0 && fallos === 0) {
  console.log(`\n✔ ${bajaron} regla(s) bajaron: corre con --update y commitea el baseline.`);
}
if (fallos > 0) {
  console.error(`\nbackend-rules: ${fallos} regla(s) empeoraron. Corrige el código; NO subas el techo.`);
  process.exit(1);
}
console.log('\nbackend-rules: OK');
