import type { Type } from '@angular/core';
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

/**
 * Pantallas reales que reemplazan al placeholder de su leaf. La clave es
 * `<modo>/<id de tab>`; lo que no está acá sigue siendo un placeholder hasta
 * que su entrega llegue.
 */
const HOJAS_REALES: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'cliente/panel': () =>
    import('./pages/panel-cliente/panel-cliente.page').then((m) => m.PanelClientePage),
  'tecnico/radar': () =>
    import('./pages/ofertas-tecnico/ofertas-tecnico.page').then((m) => m.OfertasTecnicoPage),
  'tecnico/ots': () =>
    import('./pages/panel-tecnico/panel-tecnico.page').then((m) => m.PanelTecnicoPageMobile),
  'proveedor/insumos': () =>
    import('./pages/solicitudes-proveedor/solicitudes-proveedor.page').then(
      (m) => m.SolicitudesProveedorPage,
    ),
  'proveedor/documentos': () =>
    import('./pages/documentos-proveedor/documentos-proveedor.page').then(
      (m) => m.DocumentosProveedorPage,
    ),
};

const cargarSolicitar = () =>
  import('./pages/solicitar-servicio/solicitar-servicio.page').then(
    (m) => m.SolicitarServicioPage,
  );

const cargarSeguimientoOt = () =>
  import('./pages/seguimiento-ot/seguimiento-ot.page').then((m) => m.SeguimientoOtPage);

const cargarDiagnostico = () =>
  import('./pages/diagnostico/diagnostico.page').then((m) => m.DiagnosticoPage);

const cargarPagoActa = () =>
  import('./pages/pago-acta/pago-acta.page').then((m) => m.PagoActaPage);

const cargarCalificar = () =>
  import('./pages/calificar/calificar.page').then((m) => m.CalificarPage);

const cargarEjecucion = () =>
  import('./pages/ejecucion-ot/ejecucion-ot.page').then((m) => m.EjecucionOtPage);

/**
 * Rutas que viven bajo un modo pero no tienen tab propio. Ionic las apila
 * dentro del mismo outlet, así que se abren encima del panel y el botón de
 * volver regresa a las tabs.
 */
const RUTAS_EXTRA: Partial<Record<ModoApp, Route[]>> = {
  CLIENTE: [
    {
      // A5: se abre desde el panel y vuelve a él al crear la OT.
      path: 'solicitar',
      title: 'Solicitar servicio · Cold Day',
      loadComponent: cargarSolicitar,
    },
    {
      // A6: follow-up screen for the OT. A7 (diagnostico) and A8 (pago)
      // hang off the same branch: the route is componentless and the
      // children stack in the same outlet.
      path: 'ot/:id',
      title: 'Seguimiento de la OT · Cold Day',
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Seguimiento de la OT · Cold Day',
          loadComponent: cargarSeguimientoOt,
        },
        {
          path: 'diagnostico',
          title: 'Diagnóstico y presupuesto · Cold Day',
          loadComponent: cargarDiagnostico,
        },
        {
          path: 'pago',
          title: 'Pago y acta de garantía · Cold Day',
          loadComponent: cargarPagoActa,
        },
        {
          path: 'calificar',
          title: 'Calificar servicio · Cold Day',
          loadComponent: cargarCalificar,
        },
      ],
    },
  ],
  TECNICO: [
    {
      // B3: ejecución de la OT asignada. Se abre desde el panel o al aceptar
      // una oferta; vuelve a las tabs al finalizar.
      path: 'ejecucion/:id',
      title: 'Ejecución de la OT · Cold Day',
      loadComponent: cargarEjecucion,
    },
    {
      // B4: perfil, especialidades y documentos del técnico.
      path: 'perfil',
      title: 'Mi perfil técnico · Cold Day',
      loadComponent: () =>
        import('./pages/perfil-tecnico/perfil-tecnico.page').then((m) => m.PerfilTecnicoPage),
    },
  ],
};

/** Leaf de un modo: su pantalla real o el placeholder del inventario. */
const hoja = (modo: ModoApp, id: string): Route => {
  const pantalla = PANTALLAS[id];
  return {
    path: id,
    title: `${pantalla.title} · Cold Day`,
    data: { title: pantalla.title, description: pantalla.description },
    loadComponent: HOJAS_REALES[`${modo.toLowerCase()}/${id}`] ?? cargarPlaceholder,
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
    ...MODOS[modo].tabs.map((tab) => (tab.id === 'cuenta' ? cuentaRoute() : hoja(modo, tab.id))),
    ...(RUTAS_EXTRA[modo] ?? []),
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
