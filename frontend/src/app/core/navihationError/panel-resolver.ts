import { Rol } from '../models/common.models';

/**
 * Último panel visitado. Es una preferencia del dispositivo (no del backend):
 * el usuario dual-role vuelve al contexto en el que estaba trabajando.
 */
export const CLAVE_PANEL_PREFERIDO = 'coldday.panel.preferido';

/**
 * Ruta canónica de cada panel. Es el ÚNICO mapa de paneles del frontend: lo
 * consumen `panel-redirect`, el botón "Mi Panel" del topbar y cada panel al
 * registrarse como visitado. `AuthService.getDashboardRouteForRole` resuelve
 * otra cosa (landing de login) y no debe multiplicar este mapa.
 */
const RUTA_PANEL = new Map<Rol, string>([
  ['CLIENTE', '/cliente/panel'],
  ['TECNICO', '/tecnico/panel'],
  ['ADMINISTRADOR', '/admin/dashboard'],
  ['CONTABLE', '/admin/dashboard'],
  ['PROVEEDOR', '/proveedor/panel'],
]);

/** Rutas de panel conocidas; la preferencia se valida contra este conjunto. */
export const RUTAS_PANEL: ReadonlySet<string> = new Set(RUTA_PANEL.values());

/** Ruta del panel de un rol, o `null` si ese rol no tiene panel propio. */
export function rutaDePanel(rol: Rol): string | null {
  return RUTA_PANEL.get(rol) ?? null;
}

/**
 * Resuelve a qué panel llevar al usuario:
 * 1. el último panel visitado, si sus roles actuales todavía lo permiten;
 * 2. si no, el panel de su rol primario;
 * 3. si el rol primario no tiene panel, el primer rol del conjunto que sí;
 * 4. sin coincidencias, la raíz.
 */
export function resolverPanel(rolPrimario: Rol, roles: ReadonlySet<Rol>): string {
  const permitidas = rutasPermitidas(rolPrimario, roles);
  const preferida = leerPanelPreferido();
  if (preferida && permitidas.has(preferida)) {
    return preferida;
  }

  const primaria = rutaDePanel(rolPrimario);
  if (primaria) {
    return primaria;
  }

  for (const rol of roles) {
    const ruta = rutaDePanel(rol);
    if (ruta) return ruta;
  }

  return '/';
}

/**
 * Registra el panel abierto como el último visitado ("el último gana"). Las
 * rutas que no son paneles se ignoran: la preferencia nunca apunta a una
 * pantalla interna.
 */
export function recordarPanel(ruta: string): void {
  const almacen = almacenamiento();
  if (!almacen) return;

  const normalizada = normalizarRuta(ruta);
  if (!RUTAS_PANEL.has(normalizada)) return;

  try {
    almacen.setItem(CLAVE_PANEL_PREFERIDO, normalizada);
  } catch {
    // Preferencia best-effort: sin almacenamiento la navegación sigue por rol.
  }
}

/** Preferencia guardada, solo si es una ruta de panel conocida. */
function leerPanelPreferido(): string | null {
  const almacen = almacenamiento();
  if (!almacen) return null;

  let guardada: string | null;
  try {
    guardada = almacen.getItem(CLAVE_PANEL_PREFERIDO);
  } catch {
    return null;
  }
  if (!guardada) return null;

  const ruta = normalizarRuta(guardada);
  return RUTAS_PANEL.has(ruta) ? ruta : null;
}

/** Rutas de panel que los roles actuales siguen habilitando. */
function rutasPermitidas(rolPrimario: Rol, roles: ReadonlySet<Rol>): ReadonlySet<string> {
  const permitidas = new Set<string>();
  for (const rol of roles) {
    const ruta = rutaDePanel(rol);
    if (ruta) permitidas.add(ruta);
  }
  // El rol primario cuenta aunque no esté en el conjunto: la preferencia no
  // puede dejar al usuario fuera de su propio panel.
  const primaria = rutaDePanel(rolPrimario);
  if (primaria) permitidas.add(primaria);

  return permitidas;
}

/** Sin barra final: `/cliente/panel/` y `/cliente/panel` son el mismo panel. */
function normalizarRuta(ruta: string): string {
  const limpia = ruta.trim().replace(/\/+$/, '');
  return limpia === '' ? '/' : limpia;
}

/** `localStorage` puede no existir (SSR) o estar bloqueado por el navegador. */
function almacenamiento(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
