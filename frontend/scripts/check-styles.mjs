// Lint del sistema de estilos de la app móvil.
//
// Con una sola copia del tema no hay nada que comparar contra otra: lo que se
// vigila es que la copia sea coherente consigo misma.
//
// Reglas:
//   1. Cada token --cd-* se declara UNA vez. Un segundo bloque que redefine el
//      mismo nombre gana en silencio y el valor "de arriba" deja de existir
//      (pasó con --cd-radius: 8px declarado después de 16px).
//   2. Todo var(--cd-*) apunta a un token declarado. Un typo no se ve hasta que
//      la pantalla sale sin color.
//   3. Los alias resuelven y no se ciclan.
//   4. Hex fuera de una declaración de token: techo que sólo baja.
//
// Uso: node scripts/check-styles.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const archivo = resolve(here, '..', 'projects', 'mobile', 'src', 'styles.css');

// Hex literales permitidos fuera de las declaraciones de token (deuda actual:
// colores dentro de reglas .cd-* que todavía no usan var()). Baja, no sube.
const TECHO_HEX = 63;

const css = readFileSync(archivo, 'utf8');
const lineas = css.split(/\r?\n/);

const DECL = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/;
const VAR = /var\(\s*(--cd-[a-z0-9-]+)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

const declarados = new Map();
const duplicados = [];
const valores = new Map();

lineas.forEach((linea, i) => {
  const m = DECL.exec(linea);
  if (!m) return;
  const [, nombre, valor] = m;
  if (nombre.startsWith('--cd-')) {
    if (declarados.has(nombre)) {
      duplicados.push(`${nombre} (líneas ${declarados.get(nombre)} y ${i + 1})`);
    } else {
      declarados.set(nombre, i + 1);
    }
    valores.set(nombre, valor.trim());
  }
});

// 2. referencias
const referencias = new Set();
let totalVar = 0;
for (const m of css.matchAll(VAR)) {
  referencias.add(m[1]);
  totalVar++;
}
const huerfanas = [...referencias].filter((n) => !declarados.has(n)).sort();

// 3. alias rotos o cíclicos
const rotos = [];
for (const [nombre, valor] of valores) {
  const alias = new RegExp(`^var\\(\\s*(--cd-[a-z0-9-]+)\\s*\\)$`).exec(valor);
  if (!alias) continue;
  const destino = alias[1];
  if (!declarados.has(destino)) {
    rotos.push(`${nombre} -> ${destino} (no existe)`);
    continue;
  }
  const visto = new Set([nombre]);
  let actual = destino;
  for (let saltos = 0; saltos < 10; saltos++) {
    if (visto.has(actual)) {
      rotos.push(`${nombre} -> ${destino} (ciclo en ${actual})`);
      break;
    }
    visto.add(actual);
    const sigue = new RegExp(`^var\\(\\s*(--cd-[a-z0-9-]+)\\s*\\)$`).exec(valores.get(actual) ?? '');
    if (!sigue) break;
    actual = sigue[1];
  }
}

// 4. hex fuera de declaraciones
const hexLibres = [];
lineas.forEach((linea, i) => {
  if (DECL.test(linea)) return;
  if (HEX.test(linea)) hexLibres.push(i + 1);
});

const fallas = [];
if (duplicados.length) fallas.push(`tokens declarados dos veces:\n    ${duplicados.join('\n    ')}`);
if (huerfanas.length) fallas.push(`var(--cd-*) sin declarar: ${huerfanas.join(', ')}`);
if (rotos.length) fallas.push(`alias rotos:\n    ${rotos.join('\n    ')}`);
if (hexLibres.length > TECHO_HEX) {
  fallas.push(
    `hex fuera de los tokens: ${hexLibres.length} > techo ${TECHO_HEX} (líneas ${hexLibres.slice(0, 8).join(', ')}${hexLibres.length > 8 ? ', …' : ''})`,
  );
}

console.log(`tokens --cd-*: ${declarados.size} declarados, ${totalVar} usos de var()`);
console.log(`hex fuera de tokens: ${hexLibres.length} / techo ${TECHO_HEX}`);

if (fallas.length) {
  console.error(`\nFALLA (${fallas.length})`);
  for (const f of fallas) console.error(`  - ${f}`);
  process.exit(1);
}
if (hexLibres.length < TECHO_HEX) {
  console.log(`  quedaste ${TECHO_HEX - hexLibres.length} abajo: bajá TECHO_HEX a ${hexLibres.length}`);
}
console.log('\nOK');
