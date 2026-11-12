// Auditoría de render por tamaño (DESIGN.md §10 y §11). Requiere navegador.
//
// Recorre las pantallas de cada rol en 320/360/390/430/768 px y falla si encuentra:
// desborde horizontal, texto <12 px, controles <44 px, texto recortado con
// elipsis o pestañas de la barra cortadas.
//
// Requisitos (una vez):  npm i -D playwright-core && npx playwright-core install chromium
// Con la app servida en local, backend en :8090 y CORS permitido (puerto 4200):
//   MOBILE_API_ORIGIN=http://localhost:8090 npm run mobile:start -- --port 4200
//   UI_AUDIT_PASSWORD=<demo-password del seeder> npm run ui:audit
//
// Variables: UI_AUDIT_BASE (def. http://localhost:4200) · UI_AUDIT_PASSWORD (obligatoria)
//            UI_AUDIT_CHROMIUM (ruta a un chrome/chromium; opcional) · UI_AUDIT_OUT (capturas)
//
// El login tiene rate limit (10/min por IP): el script inicia sesión UNA vez por rol
// y reutiliza la sesión en todos los tamaños. No lo cambies a un login por pantalla.
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Falta playwright-core. Instala: npm i -D playwright-core && npx playwright-core install chromium');
  process.exit(2);
}

const BASE = process.env.UI_AUDIT_BASE ?? 'http://localhost:4200';
const PASSWORD = process.env.UI_AUDIT_PASSWORD;
if (!PASSWORD) {
  console.error('Define UI_AUDIT_PASSWORD (contraseña demo del seeder local). No se guarda en el repo.');
  process.exit(2);
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`UI_AUDIT_BASE debe ser local (recibido: ${BASE}). Nunca audites con credenciales contra otro host.`);
  process.exit(2);
}
const OUT = process.env.UI_AUDIT_OUT ?? path.join(os.tmpdir(), 'cold-day-ui-audit');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { n: '320', w: 320, h: 568 },
  { n: '360', w: 360, h: 740 },
  { n: '390', w: 390, h: 844 },
  { n: '430', w: 430, h: 932 },
  { n: '768', w: 768, h: 1024 },
];
const ROLES = [
  { rol: 'cliente', user: 'cliente1@coldday.com.co', rutas: ['panel', 'equipos', 'solicitar', 'cuenta'] },
  { rol: 'tecnico', user: 'tecnico1@coldday.com.co', rutas: ['radar', 'ots', 'liquidaciones', 'perfil', 'cuenta'] },
  { rol: 'proveedor', user: 'proveedor1@coldday.com.co', rutas: ['insumos', 'documentos', 'cuenta'] },
];
// Scroll horizontal intencional (documentado en DESIGN.md §8.7).
const SCROLL_INTENCIONAL = '.cd-filtros, .cd-filtros-tecnicos, [data-scroll-x]';

const auditar = (ignorar) => {
  const vis = (e) => {
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const ok = (e) => !e.closest(ignorar);
  const fuera = [...document.querySelectorAll('*')]
    .filter((e) => vis(e) && ok(e) && (e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1))
    .slice(0, 5)
    .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 28)}`);
  const chico = [
    ...new Set(
      [...document.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && e.textContent.trim() && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 11.99)
        .map((e) => `${e.textContent.trim().slice(0, 18)}@${getComputedStyle(e).fontSize}`),
    ),
  ].slice(0, 5);
  const tap = [...document.querySelectorAll('button,a,ion-button,ion-tab-button,[role=button]')]
    .filter((e) => {
      if (!vis(e)) return false;
      const b = e.getBoundingClientRect();
      return b.height < 43.5 || b.width < 43.5;
    })
    .slice(0, 5)
    .map((e) => `${(e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 16)}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  const recortado = [...document.querySelectorAll('h1,h2,h3,strong,ion-label,button,ion-button')]
    .filter((e) => vis(e) && ok(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis' && getComputedStyle(e).overflow !== 'visible')
    .slice(0, 5)
    .map((e) => e.textContent.trim().slice(0, 18));
  const tabs = [...document.querySelectorAll('ion-tab-button ion-label')].filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent.trim());
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, fuera, chico, tap, recortado, tabs };
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.UI_AUDIT_CHROMIUM || undefined });

async function login(page, user) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('ion-input');
  await page.locator('ion-input[formcontrolname=correo] input').fill(user);
  await page.locator('ion-input[formcontrolname=password] input').fill(PASSWORD);
  await page.locator('ion-button[type=submit]').click();
  await page.waitForURL(/\/(cliente|tecnico|proveedor|solo-web)/, { timeout: 15000 });
}

const estados = {};
for (const r of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await login(await ctx.newPage(), r.user);
  estados[r.rol] = await ctx.storageState();
  await ctx.close();
}

const resultados = [];
for (const vp of VIEWPORTS) {
  const movil = vp.w < 500;
  {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: movil, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('ion-input');
    await page.waitForTimeout(600);
    resultados.push({ vp: vp.n, ruta: 'login', ...(await page.evaluate(auditar, SCROLL_INTENCIONAL)) });
    await page.screenshot({ path: path.join(OUT, `${vp.n}-login.png`) });
    await ctx.close();
  }
  for (const r of ROLES) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: true,
      isMobile: movil,
      deviceScaleFactor: 2,
      geolocation: { latitude: 7.8939, longitude: -72.5078 },
      permissions: ['geolocation'],
      storageState: estados[r.rol],
    });
    const page = await ctx.newPage();
    for (const ruta of r.rutas) {
      await page.goto(`${BASE}/${r.rol}/${ruta}`);
      await page.waitForSelector('ion-content', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(900);
      resultados.push({ vp: vp.n, ruta: `${r.rol}/${ruta}`, ...(await page.evaluate(auditar, SCROLL_INTENCIONAL)) });
      await page.screenshot({ path: path.join(OUT, `${vp.n}-${r.rol}-${ruta}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(path.join(OUT, 'resultados.json'), JSON.stringify(resultados, null, 1));

const malos = resultados.filter((x) => x.sw > x.iw || x.fuera.length || x.chico.length || x.tap.length || x.recortado.length || x.tabs.length);
console.log(`pantallas auditadas: ${resultados.length}, con hallazgos: ${malos.length}  (capturas: ${OUT})`);
for (const m of malos) {
  const h = [];
  if (m.sw > m.iw) h.push(`scrollX ${m.sw}>${m.iw}`);
  if (m.fuera.length) h.push(`fuera: ${m.fuera.join(', ')}`);
  if (m.chico.length) h.push(`<12px: ${m.chico.join(', ')}`);
  if (m.tap.length) h.push(`tap<44: ${m.tap.join(', ')}`);
  if (m.recortado.length) h.push(`recortado: ${m.recortado.join(', ')}`);
  if (m.tabs.length) h.push(`tab recortada: ${m.tabs.join(', ')}`);
  console.log(`[${m.vp}] ${m.ruta} -> ${h.join(' | ')}`);
}
process.exit(malos.length ? 1 : 0);
