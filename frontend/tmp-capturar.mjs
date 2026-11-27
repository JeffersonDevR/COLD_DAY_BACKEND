// Herramienta temporal de validación visual: renderiza el bundle móvil en Chrome
// headless, captura por CDP (no con el flag --screenshot, que falsea el encuadre)
// y reporta errores de consola por ruta. Se borra tras el uso.
import { spawnSync } from 'node:child_process';

// Rutas a auditar: se pasan como argumentos.
const rutas = process.argv.slice(2);
if (rutas.length === 0) {
  console.error('uso: node tmp-capturar.mjs /login /registro ...');
  process.exit(1);
}

// Ancho emulado: --ancho=768 para tablet/escritorio (criterio de 3 anchos).
const argAncho = rutas.find((r) => r.startsWith('--ancho='));
const ancho = argAncho ? Number(argAncho.split('=')[1]) : 390;
if (argAncho) rutas.splice(rutas.indexOf(argAncho), 1);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PUERTO = 9340;

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PUERTO}/json`);
  return r.json();
}

async function esperarChrome(intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      await targets();
      return true;
    } catch {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  return false;
}

function conectar(urlWs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(urlWs);
    let id = 0;
    const pendientes = new Map();
    const eventos = [];
    ws.addEventListener('open', () => {
      resolve({
        cmd(metodo, params = {}) {
          const mId = (id += 1);
          return new Promise((res, rej) => {
            pendientes.set(mId, { res, rej });
            ws.send(JSON.stringify({ id: mId, method: metodo, params }));
          });
        },
        eventos,
        cerrar() {
          ws.close();
        },
      });
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pendientes.has(msg.id)) {
        const { res, rej } = pendientes.get(msg.id);
        pendientes.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method) {
        eventos.push(msg);
      }
    });
  });
}

const ok = await esperarChrome();
if (!ok) {
  console.error('Chrome no respondió en el puerto de depuración');
  process.exit(1);
}

for (const ruta of rutas) {
  // Cada página en su propio target: así los mensajes de consola son inequívocos.
  const creado = await (await fetch(`http://127.0.0.1:${PUERTO}/json/new?http://127.0.0.1:8123${ruta}`, { method: 'PUT' })).json();
  const con = await conectar(creado.webSocketDebuggerUrl);
  await con.cmd('Log.enable');
  await con.cmd('Runtime.enable');
  await con.cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise((res) => setTimeout(res, 6500));

  const mapa = await con.cmd('Runtime.evaluate', {
    expression: `(() => {
      const W = ${ancho};
      const se = document.querySelector('ion-content')?.shadowRoot?.querySelector('.inner-scroll');
      const desborda = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > W + 1 && el.offsetParent !== null) desborda.push({t:el.tagName.toLowerCase(),txt:(el.textContent||'').trim().slice(0,50),right:Math.round(el.getBoundingClientRect().right),parent:el.parentElement?el.parentElement.tagName.toLowerCase()+'.'+String(el.parentElement.className).split(' ')[0]:null});
      });
      // Touch targets por debajo de 44 px (criterio de campo del brief).
      const pequenos = [];
      document.querySelectorAll('button, a, ion-button, ion-item, input, select, textarea').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || el.offsetParent === null) return;
        const h = Math.round(r.height);
        if (h < 44) pequenos.push({ t: el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0], h });
      });
      return JSON.stringify({
        scrollW: se ? se.scrollWidth : document.documentElement.scrollWidth,
        visibles: document.querySelectorAll('[data-testid]').length,
        desbordan: desborda.slice(0, 8),
        pequenos: pequenos.slice(0, 12),
        titulo: document.title,
        h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 60),
      });
    })()`,
    returnByValue: true,
  });

  const shot = await con.cmd('Page.captureScreenshot', { format: 'png' });
  const nombre = `${ruta.replace(/[^a-z0-9]/gi, '_') || 'home'}-${ancho}`;
  const fs = await import('node:fs/promises');
  await fs.writeFile(
    `../out/capturas/${nombre}.png`,
    Buffer.from(shot.data, 'base64'),
  );

  const errores = con.eventos
    .filter((e) => e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level))
    .map((e) => `${e.params.entry.level}: ${String(e.params.entry.text).slice(0, 160)}`)
    .slice(0, 8);

  console.log(`### ${ruta}`);
  console.log(mapa.result.value);
  console.log(errores.length ? errores.join('\n') : 'consola limpia');
  con.cerrar();
}
