import type { Route, Routes } from '@angular/router';
import { MODOS, ModoApp } from './modo/modo';
import { authGuardMobile, modoActualGuard, modoGuard } from './modo/modo.guards';

interface Pantalla {
  readonly title: string;
  readonly description: string;
}

/**
 * Copy de los leaves de P1. Cada uno es un placeholder hasta que su pantalla de
 * negocio llegue en P2; la ruta y el tab ya existen para fijar la navegación.
 */
const PANTALLAS: Record<string, Pantalla> = {
  panel: {
    title: 'Panel',
    description: 'Tus servicios activos, el seguimiento de cada OT y el acceso rápido a pedir ayuda.',
  },
  equipos: {
    title: 'Equipos',
    description: 'El historial de tus equipos y los servicios que les hicimos.',
  },
  radar: {
    title: 'Radar',
    description: 'Las ofertas disponibles cerca tuyo, con su distancia y su tarifa.',
  },
  ots: {
    title: 'Mis OTs',
    description: 'Las órdenes asignadas, su estado y el próximo paso de cada una.',
  },
  liquidaciones: {
    title: 'Liquidaciones',
    description: 'Lo que la plataforma te debe y el estado de cada consignación.',
  },
  insumos: {
    title: 'Insumos',
    description: 'Los requerimientos de insumos de los técnicos que podés cotizar.',
  },
  documentos: {
    title: 'Documentos',
    description: 'Los papeles de tu empresa y su estado de validación.',
  },
};

const ETIQUETA_MODO: Record<ModoApp, string> = {
  CLIENTE: 'Cliente',
  TECNICO: 'Técnico',
  PROVEEDOR: 'Proveedor',
};

const cargarPlaceholder = () =>
  import('./pages/placeholder.page').then((m) => m.PlaceholderPage);

const cargarCuenta = () => import('./pages/cuenta/cuenta.page').then((m) => m.CuentaPage);

/** Leaf placeholder del inventario: título, copy y la misma pantalla compartida. */
const hoja = (id: string): Route => {
  const pantalla = PANTALLAS[id];
  return {
    path: id,
    title: `${pantalla.title} · Cold Day`,
    data: { title: pantalla.title, description: pantalla.description },
    loadComponent: cargarPlaceholder,
  };
};

/** Cuenta se comparte entre los tres modos y también vive en `/cuenta`. */
const cuentaRoute = (): Route => ({
  path: 'cuenta',
  title: 'Mi cuenta · Cold Day',
  loadComponent: cargarCuenta,
});

/**
 * Tabs de un modo. El id de cada tab (`MODOS[modo].tabs`) ES el segmento de
 * ruta: Ionic navega a `<prefijo>/<tab>` y el tab queda seleccionado solo.
 */
const modoRoute = (modo: ModoApp): Route => ({
  path: modo.toLowerCase(),
  title: `${ETIQUETA_MODO[modo]} · Cold Day`,
  canActivate: [authGuardMobile, modoGuard(modo)],
  data: { modo },
  loadComponent: () => import('./pages/modo-tabs/modo-tabs.page').then((m) => m.ModoTabsPage),
  children: [
    { path: '', pathMatch: 'full', redirectTo: MODOS[modo].tabs[0].id },
    ...MODOS[modo].tabs.map((tab) => (tab.id === 'cuenta' ? cuentaRoute() : hoja(tab.id))),
  ],
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Ingresar · Cold Day',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    // A2: alta pública, sin sesión. Cada rol se crea contra su endpoint atómico.
    path: 'registro',
    title: 'Crear cuenta · Cold Day',
    loadComponent: () => import('./pages/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'solo-web',
    title: 'Usá la web · Cold Day',
    canActivate: [authGuardMobile],
    loadComponent: () => import('./pages/solo-web/solo-web.page').then((m) => m.SoloWebPage),
  },
  modoRoute('CLIENTE'),
  modoRoute('TECNICO'),
  modoRoute('PROVEEDOR'),
  // Nombre canónico del inventario (A3): la misma pantalla, fuera de las tabs.
  {
    path: 'cuenta',
    title: 'Mi cuenta · Cold Day',
    canActivate: [authGuardMobile, modoActualGuard],
    loadComponent: cargarCuenta,
  },
  { path: '**', redirectTo: 'login' },
];
