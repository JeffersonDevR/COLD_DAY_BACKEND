// Guardia ejecutable del sistema de diseño (ver ../../DESIGN.md §10).
//
// Cada regla cuenta infracciones en el código real y las compara con un techo
// guardado en ui-rules.baseline.json. El techo solo BAJA: si una regla sube,
// el comando falla (exit 1) y lista los primeros infractores. Así ni una
// persona ni un modelo pueden reintroducir lo que el diseño prohíbe, y la deuda
// existente no bloquea el trabajo mientras no crezca.
//
// Uso:
//   node scripts/check-ui-rules.mjs            verifica (CI, hooks, mobile:build/test)
//   node scripts/check-ui-rules.mjs --update   baja el techo a lo medido (solo si bajó)
//   node scripts/check-ui-rules.mjs --verbose  muestra TODOS los infractores
//
// Reglas = IDs de DESIGN.md. Si agregas una regla aquí, agrégala allí.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = dirname(fileURLToPath(import.meta.url));
const raíz = resolve(aquí, '..');
const BASELINE = join(aquí, 'ui-rules.baseline.json');
const VERBOSE = process.argv.includes('--verbose');
const UPDATE = process.argv.includes('--update');

const ÁMBITOS = {
  mobile: join(raíz, 'projects', 'mobile', 'src'),
  web: join(raíz, 'src'),
};
const EXT = new Set(['.css', '.html', '.ts']);
const IGNORAR = (ruta) =>
  ruta.endsWith('.spec.ts') ||
  ruta.includes(`${sep}environments${sep}`) ||
  ruta.includes(`${sep}environment${sep}`) ||
  /mobile-origin\.ts$|api-origin\.ts$|maps-key\.ts$/.test(ruta);

function* recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) {
      if (nombre === 'node_modules' || nombre === 'dist') continue;
      yield* recorrer(ruta);
    } else if (EXT.has(nombre.slice(nombre.lastIndexOf('.'))) && !IGNORAR(ruta)) {
      yield ruta;
    }
  }
}

const aPx = (valor, unidad) => (unidad === 'rem' ? parseFloat(valor) * 16 : parseFloat(valor));

/** Cada regla: id, ámbitos, tipos de archivo y `lineas(texto, ext) -> [n° de línea]`. */
const REGLAS = [
  {
    id: 'UI-T1',
    desc: 'texto por debajo de 12 px',
    ámbitos: ['mobile', 'web'],
    detectar: (linea) => {
      const css = [...linea.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)].some(
        (m) => aPx(m[1], m[2]) < 11.99,
      );
      const tw = [...linea.matchAll(/text-\[([\d.]+)(px|rem)\]/g)].some((m) => aPx(m[1], m[2]) < 11.99);
      return css || tw;
    },
  },
  {
    id: 'UI-T2',
    desc: 'peso tipográfico mayor a 700',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /font-weight:\s*(800|900)\b|\bfont-(black|extrabold)\b|font-\[(800|900)\]/.test(l),
  },
  {
    id: 'UI-C1',
    desc: 'gris prohibido en texto (#64748b / #475569 / slate-500 / slate-600)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /#64748b|#475569|\b(text|placeholder)-slate-(500|600)\b/i.test(l),
  },
  {
    id: 'UI-A1',
    desc: 'zoom bloqueado (user-scalable=no / maximum-scale=1)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /user-scalable\s*=\s*no|maximum-scale\s*=\s*1\b/.test(l),
  },
  {
    id: 'UI-A2',
    desc: 'outline eliminado sin reemplazo de foco',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /outline:\s*(none|0)\b|\b(focus:)?outline-none\b/.test(l),
  },
  {
    id: 'UI-A3',
    desc: 'contenedor no semántico con (click) (usa <button> o <a>)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /<(div|article|section|li|span)\b[^>]*\(click\)/.test(l),
  },
  {
    id: 'UI-D1',
    desc: 'blur decorativo (backdrop-filter / backdrop-blur)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /backdrop-filter|\bbackdrop-blur/.test(l),
  },
  {
    id: 'UI-D2',
    desc: 'halo de offset cero (box-shadow 0 0 Npx con cian)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /box-shadow:\s*0\s+0\s+\d+px\s+rgba\(\s*34\s*,\s*211|shadow-\[0_0_/.test(l),
  },
  {
    id: 'UI-D3',
    desc: 'gradiente (el sistema no usa gradientes)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) => /(linear|radial|conic)-gradient\(|\bbg-gradient-to-/.test(l),
  },
  {
    id: 'UI-D4',
    desc: 'variante dark: (el sistema tiene una sola apariencia)',
    ámbitos: ['web'],
    detectar: (l) => /\bdark:[a-z[]/.test(l),
  },
  {
    id: 'UI-S1',
    desc: 'safe-area con env() directo (usa var(--cd-safe-top|bottom))',
    ámbitos: ['mobile'],
    detectar: (l) => /env\(safe-area-inset-(top|bottom)/.test(l) && !/^\s*--cd-safe-/.test(l),
  },
  {
    id: 'UI-L1',
    desc: 'voseo en copy (el producto habla en tuteo, ver PRODUCT.md)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) =>
      /\b(tenés|podés|querés|sabés|elegí|elegís|pedí|creá|revisá|mantené|aceptás|compartís|hacé|mirá|tocá|esperá|intentá|volvé|usá|ingresá|agregá|confirmá|seleccioná|cargá|subí|escribí|decime|avisanos|contanos|seguí|completá|probá|iniciá|regularizalas|revisalos|cerrá|abrí|llamá|escaneá|activá|habilitá|descargá|guardá|enviá)\b/i.test(
        l,
      ),
  },
  {
    id: 'UI-L2',
    desc: 'fuga de mercado Argentina (heladera, CUIT, AFIP, .com.ar, +54…)',
    ámbitos: ['mobile', 'web'],
    detectar: (l) =>
      /\b(heladera|lavarropas|CUIT|CUIL|AFIP|CBU|CVU|COPITEC|INTI|Palermo|Belgrano|CABA)\b|\.com\.ar|tel:\+54|Mercado\s?Pago/.test(
        l,
      ),
  },
];

// --- medir -----------------------------------------------------------------
const medido = {}; // regla -> ámbito -> { cuenta, ejemplos[] }
for (const regla of REGLAS) {
  medido[regla.id] = {};
  for (const ámbito of regla.ámbitos) medido[regla.id][ámbito] = { cuenta: 0, ejemplos: [] };
}

for (const [ámbito, dir] of Object.entries(ÁMBITOS)) {
  if (!existsSync(dir)) continue;
  for (const archivo of recorrer(dir)) {
    const líneas = readFileSync(archivo, 'utf8').split(/\r?\n/);
    líneas.forEach((texto, i) => {
      for (const regla of REGLAS) {
        if (!regla.ámbitos.includes(ámbito)) continue;
        if (regla.detectar(texto)) {
          const m = medido[regla.id][ámbito];
          m.cuenta += 1;
          if (VERBOSE || m.ejemplos.length < 5) {
            m.ejemplos.push(`${relative(raíz, archivo).split(sep).join('/')}:${i + 1}  ${texto.trim().slice(0, 90)}`);
          }
        }
      }
    });
  }
}

// --- comparar --------------------------------------------------------------
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
const nuevo = {};
let fallos = 0;
let bajaron = 0;
const filas = [];

for (const regla of REGLAS) {
  nuevo[regla.id] = {};
  for (const ámbito of regla.ámbitos) {
    const { cuenta, ejemplos } = medido[regla.id][ámbito];
    const techo = base?.[regla.id]?.[ámbito];
    nuevo[regla.id][ámbito] = techo === undefined ? cuenta : Math.min(techo, cuenta);
    let estado = 'ok';
    if (techo === undefined) estado = base ? 'regla nueva' : 'sin baseline';
    else if (cuenta > techo) {
      estado = 'SUBIÓ';
      fallos += 1;
    } else if (cuenta < techo) {
      estado = 'bajó';
      bajaron += 1;
    }
    filas.push({ regla: regla.id, ámbito, cuenta, techo: techo ?? '-', estado, desc: regla.desc, ejemplos });
  }
}

const ancho = (s, n) => String(s).padEnd(n);
console.log(`${ancho('regla', 7)} ${ancho('ámbito', 7)} ${ancho('ahora', 6)} ${ancho('techo', 6)} estado`);
for (const f of filas) {
  console.log(`${ancho(f.regla, 7)} ${ancho(f.ámbito, 7)} ${ancho(f.cuenta, 6)} ${ancho(f.techo, 6)} ${f.estado}  ${f.desc}`);
}

for (const f of filas.filter((x) => x.estado === 'SUBIÓ')) {
  console.log(`\n✖ ${f.regla} (${f.ámbito}): ${f.cuenta} > techo ${f.techo} — ${f.desc}`);
  for (const e of f.ejemplos) console.log(`    ${e}`);
}

if (UPDATE || !base) {
  // El techo solo baja: --update escribe min(techo, medido).
  writeFileSync(BASELINE, JSON.stringify(nuevo, null, 2) + '\n');
  console.log(`\nbaseline ${base ? 'actualizado' : 'creado'}: ${relative(raíz, BASELINE)}`);
} else if (bajaron > 0 && fallos === 0) {
  console.log(`\n✔ ${bajaron} regla(s) bajaron: corre "npm run ui:check -- --update" y commitea el baseline.`);
}

if (fallos > 0) {
  console.error(`\nui-rules: ${fallos} regla(s) empeoraron. Corrige el código; NO subas el techo.`);
  process.exit(1);
}
console.log('\nui-rules: OK');
