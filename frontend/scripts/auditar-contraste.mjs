// Chequeo puntual de contraste WCAG sobre los tokens del tema móvil.
// No forma parte del build: se corre a mano para auditar la paleta.
import { readFileSync } from 'node:fs';

const css = readFileSync('projects/mobile/src/styles.css', 'utf8');
const token = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
  if (!m) throw new Error(`token no encontrado: ${name}`);
  return m[1];
};

/** Tokens de Ionic: se declaran con su nombre completo (`--ion-color-*`). */
const ion = (nombre) => {
  const m = new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
  if (!m) throw new Error(`token no encontrado: ${nombre}`);
  return m[1];
};

const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const lum = (hex) => {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((x) => x + x).join('') : n;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const superficies = {
  canvas: token('cd-canvas'),
  surface: token('cd-surface'),
  'surface-2': token('cd-surface-2'),
};

const textos = {
  'text-1': token('cd-text-1'),
  'text-2': token('cd-text-2'),
  'text-3': token('cd-text-3'),
  'text-4': token('cd-text-4'),
  action: token('cd-action'),
  'success-ink': token('cd-success-ink'),
};

for (const [nombreSup, sup] of Object.entries(superficies)) {
  console.log(`\n== ${nombreSup} (${sup}) ==`);
  for (const [nombre, color] of Object.entries(textos)) {
    const r = ratio(color, sup);
    const veredicto = r >= 4.5 ? 'AA texto' : r >= 3 ? 'solo texto grande' : 'FALLA';
    console.log(`${nombre.padEnd(12)} ${color}  ${r.toFixed(2)}:1  ${veredicto}`);
  }
}

// Tintes de estado usados en las pantallas nuevas (alfa sobre surface).
const mezclar = (hex, alfa, base) => {
  const p = (h) => {
    const n = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [a, b] = [p(hex), p(base)];
  const out = a.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa)));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
};

console.log('\n== tintes de estado sobre surface ==');
const pares = [
  ['success-ink sobre success 12%', token('cd-success-ink'), mezclar(token('cd-success'), 0.12, token('cd-surface'))],
  ['action sobre action 10%', token('cd-action'), mezclar(token('cd-action'), 0.1, token('cd-surface'))],
  ['text-1 sobre surface-2', token('cd-text-1'), token('cd-surface-2')],
];
for (const [etiqueta, frente, fondo] of pares) {
  const r = ratio(frente, fondo);
  console.log(`${etiqueta.padEnd(34)} ${r.toFixed(2)}:1  ${r >= 4.5 ? 'AA' : 'REVISAR'}`);
}

// Texto sobre relleno de marca: CTA primario y número dentro del globo del mapa.
console.log('\n== texto sobre relleno de marca ==');
const rellenos = [
  ['--ion-color-primary-contrast sobre action', ion('--ion-color-primary-contrast'), token('cd-action')],
  ['#04121a sobre action (globo)', '#04121a', token('cd-action')],
  ['#04121a sobre ámbar (elegido)', '#04121a', token('cd-warn')],
];
for (const [etiqueta, frente, fondo] of rellenos) {
  const r = ratio(frente, fondo);
  console.log(`${etiqueta.padEnd(34)} ${r.toFixed(2)}:1  ${r >= 4.5 ? 'AA' : 'REVISAR'}`);
}
