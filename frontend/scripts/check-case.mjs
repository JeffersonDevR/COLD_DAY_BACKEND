// check-case.mjs — detecta imports relativos cuya ruta no coincide EXACTAMENTE
// (mayusculas/minusculas) con un archivo en disco. Windows resuelve igual; Linux
// (CI) no, asi que un import mal capitalizado compila en local y rompe el build.
//
// Uso: node check-case.mjs <carpeta-raiz>
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const problemas = [];
let revisados = 0;

/** Resuelve `spec` desde `desdeDir` verificando segmento a segmento. */
function resolverExacto(desdeDir, spec) {
  const segmentos = spec.split('/').filter((s) => s !== '.');
  let actual = desdeDir;
  for (let i = 0; i < segmentos.length; i++) {
    const seg = segmentos[i];
    if (seg === '..') {
      actual = dirname(actual);
      continue;
    }
    const esUltimo = i === segmentos.length - 1;
    const entradas = existsSync(actual) ? readdirSync(actual) : [];
    // En el ultimo segmento el import omite la extension: se acepta el nombre
    // exacto tal cual o con .ts/.d.ts, siempre respetando mayusculas.
    const candidatos = esUltimo ? [seg, `${seg}.ts`, `${seg}.d.ts`] : [seg];
    const encontrado = candidatos.find((c) => entradas.includes(c));
    if (!encontrado) {
      return { ok: false, ruta: join(actual, seg) };
    }
    actual = join(actual, encontrado);
  }
  return { ok: true, ruta: actual };
}

function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'node_modules' || entrada === 'dist') continue;
      recorrer(ruta);
      continue;
    }
    if (!entrada.endsWith('.ts')) continue;
    if (entrada.endsWith('.spec.ts') || entrada.endsWith('.d.ts')) continue;

    const codigo = readFileSync(ruta, 'utf8');
    for (const m of codigo.matchAll(/from\s+'(\.[^']+)'|import\s*\(\s*'(\.[^']+)'\s*\)/g)) {
      const spec = m[1] ?? m[2];
      revisados++;
      const { ok, ruta: esperado } = resolverExacto(dirname(ruta), spec);
      if (!ok) {
        problemas.push({ archivo: ruta, spec, motivo: 'segmento con mayusculas distintas o inexistente', esperado });
      }
    }
  }
}

recorrer(root);

if (problemas.length === 0) {
  console.log(`OK: ${revisados} imports relativos, 0 desalineados con el sistema de archivos.`);
} else {
  console.log(`PROBLEMAS: ${problemas.length} de ${revisados} imports`);
  for (const p of problemas) {
    console.log(`- ${p.archivo.replace(root + sep, '')}  import '${p.spec}' -> ${p.motivo}`);
    console.log(`    se esperaba: ${p.esperado}`);
  }
}
process.exit(problemas.length === 0 ? 0 : 1);
