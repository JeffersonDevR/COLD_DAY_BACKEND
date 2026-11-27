// Servidor estático mínimo para validar el bundle móvil en un navegador real.
// Sirve dist/mobile/browser con fallback a index.html (rutas de Angular).
// Uso: node scripts/servir-movil.mjs [puerto]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '..', 'dist', 'mobile', 'browser');
const puerto = Number(process.argv[2] ?? 8123);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${puerto}`);
  // Sanea la ruta: nunca salir de la raíz del bundle.
  const relativa = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const candidata = join(raiz, relativa);

  try {
    const contenido = await readFile(candidata);
    res.writeHead(200, { 'content-type': TIPOS[extname(candidata)] ?? 'application/octet-stream' });
    res.end(contenido);
  } catch {
    try {
      const index = await readFile(join(raiz, 'index.html'));
      res.writeHead(200, { 'content-type': TIPOS['.html'] });
      res.end(index);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('no encontrado');
    }
  }
});

servidor.listen(puerto, '127.0.0.1', () => {
  console.log(`[servir-movil] http://127.0.0.1:${puerto} → ${raiz}`);
});
