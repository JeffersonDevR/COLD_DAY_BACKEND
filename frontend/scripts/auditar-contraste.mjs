// Contraste WCAG de las paletas del tema móvil.
//
// Por defecto imprime el informe (comportamiento histórico). Con --strict falla
// si cualquier par queda por debajo del umbral: 4,5:1 para texto y 3:1 para
// bordes/iconos/foco. `npm run ui:check` lo llama en modo estricto, así que el
// CI lo ejecuta en los dos jobs de frontend-ci.yml sin tocar el workflow.
//
// Uso: node scripts/auditar-contraste.mjs [--strict]
import { readFileSync } from 'node:fs';

const estricto = process.argv.includes('--strict');
const CAPAS = ['tokens.css', 'base.css', 'componentes.css', 'pantallas.css'];
const css = CAPAS.map((nombre) => readFileSync(`projects/mobile/src/styles/${nombre}`, 'utf8')).join('\n');
const token = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
  if (!m) throw new Error(`token no encontrado: ${name}`);
  return m[1];
};
const ion = (nombre) => {
  const m = new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
  if (!m) throw new Error(`token no encontrado: ${nombre}`);
  return m[1];
};

const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex) => {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((x) => x + x).join('') : n;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mezclar = (hex, alfa, base) => {
  const [a, b] = [rgb(hex), rgb(base)];
  return '#' + a.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa))
    .toString(16).padStart(2, '0')).join('');
};

// Paleta oscura: los tokens del CSS son la unica fuente de verdad.
const oscuro = {
  canvas: token('cd-canvas'),
  surface: token('cd-surface'),
  'surface-2': token('cd-surface-2'),
  'text-1': token('cd-text-1'),
  'text-2': token('cd-text-2'),
  'text-3': token('cd-text-3'),
  'text-4': token('cd-text-4'),
  action: token('cd-action'),
  success: token('cd-success'),
  warn: token('cd-warn'),
  'success-ink': token('cd-success-ink'),
  'warn-ink': token('cd-warn-ink'),
  'line-strong': token('cd-line-strong'),
  'on-action': ion('--ion-color-primary-contrast'),
  'on-warn': token('cd-warn-on'),
  'tint-action': 0.1,
  'tint-success': 0.12,
  'tint-warn': 0.12,
};

// Paleta clara propuesta: se audita aunque todavia no este implementada.
const claro = JSON.parse(readFileSync('scripts/contrast-light.json', 'utf8'));

const fallos = [];
function revisar(paleta, nombre, etiqueta, frente, fondo, minimo) {
  const r = ratio(frente, fondo);
  const ok = r >= minimo;
  if (!ok) fallos.push(`${nombre} · ${etiqueta}: ${r.toFixed(2)}:1 < ${minimo}:1`);
  console.log(
    `${etiqueta.padEnd(42)} ${frente} / ${fondo}  ${r.toFixed(2)}:1  ` +
    `${ok ? (minimo === 3 ? 'AA no-texto' : 'AA texto') : 'FALLA'}`,
  );
}

function auditar(paleta, nombre) {
  console.log(`\n===== ${nombre} =====`);
  for (const sup of ['canvas', 'surface', 'surface-2']) {
    console.log(`\n-- ${sup} (${paleta[sup]}) --`);
    for (const txt of ['text-1', 'text-2', 'text-3', 'text-4', 'action', 'success-ink', 'warn-ink']) {
      revisar(paleta, nombre, `${txt} sobre ${sup}`, paleta[txt], paleta[sup], 4.5);
    }
  }
  console.log('\n-- textos sobre tinte de estado --');
  revisar(paleta, nombre, 'success-ink sobre success tint',
    paleta['success-ink'], mezclar(paleta.success, paleta['tint-success'], paleta.surface), 4.5);
  revisar(paleta, nombre, 'action sobre action tint',
    paleta.action, mezclar(paleta.action, paleta['tint-action'], paleta.surface), 4.5);
  revisar(paleta, nombre, 'warn-ink sobre warn tint',
    paleta['warn-ink'], mezclar(paleta.warn, paleta['tint-warn'], paleta.surface), 4.5);

  console.log('\n-- texto sobre relleno de marca --');
  revisar(paleta, nombre, 'on-action sobre action', paleta['on-action'], paleta.action, 4.5);
  revisar(paleta, nombre, 'on-warn sobre warn', paleta['on-warn'], paleta.warn, 4.5);

  console.log('\n-- no texto: bordes, iconos y foco --');
  revisar(paleta, nombre, 'line-strong sobre surface', paleta['line-strong'], paleta.surface, 3);
  revisar(paleta, nombre, 'action sobre surface (foco)', paleta.action, paleta.surface, 3);
}

auditar(oscuro, 'OSCURO (tokens del CSS)');
auditar(claro, 'CLARO (propuesta)');

console.log(`\nresumen: ${fallos.length} par(es) fuera de umbral`);
for (const f of fallos) console.log('  - ' + f);
if (estricto && fallos.length) process.exit(1);
