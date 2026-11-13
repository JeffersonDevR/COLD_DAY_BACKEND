// design-diff.mjs — compara los prototipos HTML de Stitch (docs/design/dark-ops/*)
// contra la implementación móvil, para detectar desviaciones 1:1.
//
// Uso: node scripts/design-diff.mjs
//   node scripts/design-diff.mjs > informe.md
//
// Qué extrae de cada export: título, marcas/anchos, destinos del nav inferior,
// fuentes, y-y-solo-y colores del tema Tailwind declarado. Lo que hace falta
// implementar (Iconos Material vs ionicons) se anota, no se dif.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// El script vive en frontend/scripts; los exports de Stitch están en
// <repo>/docs/design. Dos niveles por la estructura de carpetas del repo.
const root = resolve(here, '..', '..', 'docs', 'design', 'dark-ops');

const pantallas = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'code.html')))
  .map((d) => {
    const html = readFileSync(join(root, d.name, 'code.html'), 'utf8');
    const titulo = (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? d.name;

    // Contenedor: Stitch centra todo en un marco de teléfono.
    const anchos = [...new Set([...html.matchAll(/max-w-\[(\d+)px\]/g)].map((m) => m[1]))];

    // Nav inferior: el "source of truth" de destinos del modo.
    const nav = (html.match(/<nav[\s\S]{0,1200}?<\/nav>/) || [''])[0];
    const destinos = [];
    for (const m of nav.matchAll(/data-icon="([a-z_]+)"[^>]*>([a-zA-Z_]+)</g)) {
      destinos.push({ icono: m[1], glyph: m[2] });
    }
    const etiquetasNav = [...nav.matchAll(/<div class="[^"]*">\s*([A-Z][A-Za-z ]{2,24})\s*<\/div>/g)].map((m) => m[1]);

    // Fuentes declaradas en los links de Google Fonts (sin Material Symbols).
    const fuentes = [...new Set([...html.matchAll(/family=([A-Za-z+:%.0-9]+)/g)].map((m) => m[1]).filter((f) => !f.startsWith('Material')))];

    // Colores del tema Tailwind con nombre semántico.
    const coloresTema = {};
    const bloqueConfig = (html.match(/tailwind\.config = \{[\s\S]{0,4000}/) || [''])[0];
    for (const m of bloqueConfig.matchAll(/"([a-z-]+)":\s*"(#[0-9a-fA-F]{6})"/g)) {
      coloresTema[m[1]] = m[2];
    }

    const pideSeguro = /pb-safe|pt-safe/.test(html);
    return { carpeta: d.name, titulo, anchos, destinos, etiquetasNav, fuentes, coloresTema, pideSeguro };
  });

// Referencias de la implementación a contrastar (viven en el proyecto móvil).
const modos = readFileSync(
  resolve(here, '..', 'projects', 'mobile', 'src', 'app', 'modo', 'modo.ts'),
  'utf8',
);
const tabsPorModo = {};
for (const m of modos.matchAll(/(\"CLIENTE\"|\"TECNICO\"|\"PROVEEDOR\"): \{[\s\S]*?tabs: \[([\s\S]*?)\]/g)) {
  tabsPorModo[m[1].replaceAll('"', '')] = [...m[2].matchAll(/id: '([a-z]+)'/g)].map((t) => t[1]);
}

// Informe por pantalla + veredicto de nav.
const lineas = [];
lineas.push('# design-diff — Stitch (docs/design/dark-ops) vs móvil\n');
lineas.push('Generado por scripts/design-diff.mjs. No incluye hallazgos de DOM (ver impeccable detect sobre la app corriendo).\n');
for (const p of pantallas) {
  lineas.push(`## ${p.carpeta} — ${p.titulo}`);
  lineas.push(`- Marco: max-w ${p.anchos.join(', ') || '(sin marco)'} ${p.pideSeguro ? '· usa safe-area' : ''}`);
  lineas.push(`- Fuentes: ${p.fuentes.join(' + ') || '(no declaradas en links)'}`);
  if (p.destinos.length) {
    lineas.push(`- Nav inferior: ${p.destinos.map((d) => `${d.etiqueta ?? d.glyph} (${d.icono})`).join(' · ')}`);
  }
  lineas.push('');
}
lineas.push('## Nav por modo — export vs implementación (modo.ts)\n');
const exportPorModo = {
  CLIENTE: ['Panel', 'Equipos', 'Perfil'],
  TECNICO: ['Radar', 'Mis OTs', 'Perfil'],
  PROVEEDOR: ['Insumos', 'Documentos', 'Perfil'],
};
for (const modo of Object.keys(tabsPorModo)) {
  const esperado = exportPorModo[modo] ?? [];
  // la implementación usa ids; el export etiquetas. Se imprime lado a lado.
  lineas.push(`- **${modo}** export: ${esperado.join(' · ')} — implementación ids: ${tabsPorModo[modo].join(' · ')}`);
}
writeFileSync(
  resolve(here, '..', '..', 'docs', 'design', 'dark-ops', 'diff-implementacion.md'),
  lineas.join('\n'),
  'utf8',
);
console.log('Informes escritos: docs/design/dark-ops/diff-implementacion.md');
