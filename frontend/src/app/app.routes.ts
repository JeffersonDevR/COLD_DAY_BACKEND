import { Routes } from '@angular/router';
import { authGuard } from './core/shared/infrastructure/auth/auth.guard';
import { guestGuard } from './core/shared/infrastructure/auth/guest.guard';
import { roleGuard } from './core/shared/infrastructure/auth/role.guard';
import { PanelRedirectComponent } from './core/shared/presentation/panel-redirect';

export const routes: Routes = [
  // La landing pública vive en un proyecto separado (landing/); la app arranca en login.
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./modules/usuarios/presentation/login-page').then(m => m.LoginPage),
    title: 'Ingreso al Sistema - COLD DAY'
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./modules/usuarios/presentation/registro-page').then(m => m.RegistroPage),
    title: 'Registro de Cuenta - COLD DAY'
  },
  {
    path: 'recuperar',
    canActivate: [guestGuard],
    loadComponent: () => import('./modules/usuarios/presentation/recuperar-page').then(m => m.RecuperarPage),
    title: 'Recuperar Contraseña - COLD DAY'
  },

  // Redirección inteligente de Panel
  {
    path: 'panel',
    canActivate: [authGuard],
    component: PanelRedirectComponent
  },

  // Rutas de Clientes
  {
    path: 'cliente/panel',
    canActivate: [authGuard, roleGuard(['CLIENTE', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/clientes/presentation/panel-cliente-page').then(m => m.PanelClientePage),
    title: 'Panel Cliente - COLD DAY'
  },
  {
    path: 'cliente/solicitar',
    canActivate: [authGuard, roleGuard(['CLIENTE', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/clientes/presentation/solicitar-servicio-page').then(m => m.SolicitarServicioPage),
    title: 'Solicitar Servicio Técnico - COLD DAY'
  },
  {
    path: 'cliente/ot/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/clientes/presentation/seguimiento-ot-page').then(m => m.SeguimientoOtPage),
    title: 'Seguimiento de Orden de Trabajo'
  },
  {
    path: 'cliente/ot/:id/diagnostico',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/clientes/presentation/diagnostico-ot-page').then(m => m.DiagnosticoOtPage),
    title: 'Aprobación de Presupuesto - COLD DAY'
  },
  {
    path: 'cliente/ot/:id/pago',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/clientes/presentation/pago-acta-page').then(m => m.PagoActaPage),
    title: 'Acta de Entrega y Pago - COLD DAY'
  },
  {
    path: 'cliente/ot/:id/calificar',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/clientes/presentation/calificar-servicio-page').then(m => m.CalificarServicioPage),
    title: 'Calificar Servicio - COLD DAY'
  },
  {
    path: 'cliente/equipos',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/clientes/presentation/historial-equipos-page').then(m => m.HistorialEquiposPage),
    title: 'Hoja de Vida de Equipos - COLD DAY'
  },

  // Rutas de Técnicos
  {
    path: 'tecnico/panel',
    canActivate: [authGuard, roleGuard(['TECNICO', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/tecnicos/presentation/panel-tecnico-page').then(m => m.PanelTecnicoPage),
    title: 'Panel Operativo Técnico - COLD DAY'
  },
  {
    path: 'tecnico/ofertas',
    canActivate: [authGuard, roleGuard(['TECNICO', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/tecnicos/presentation/ofertas-page').then(m => m.OfertasPage),
    title: 'Radar de Ofertas en Vivo - COLD DAY'
  },
  {
    path: 'tecnico/ejecucion/:id',
    canActivate: [authGuard, roleGuard(['TECNICO', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/tecnicos/presentation/ejecucion-ot-page').then(m => m.EjecucionOtPage),
    title: 'Ejecución de Servicio Técnico'
  },
  {
    path: 'tecnico/documentos',
    canActivate: [authGuard, roleGuard(['TECNICO', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/tecnicos/presentation/perfil-documentos-page').then(m => m.PerfilDocumentosPage),
    title: 'Acreditaciones y Documentos - COLD DAY'
  },
  {
    path: 'tecnico/liquidaciones',
    canActivate: [authGuard, roleGuard(['TECNICO', 'ADMINISTRADOR'])],
    loadComponent: () => import('./modules/tecnicos/presentation/liquidaciones-tecnico-page').then(m => m.LiquidacionesTecnicoPage),
    title: 'Liquidaciones y Consignaciones - COLD DAY'
  },

  // Rutas Administrativas y Contables
  {
    path: 'admin/dashboard',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./modules/administracion/presentation/dashboard-admin-page').then(m => m.DashboardAdminPage),
    title: 'Torre de Control Administrativa - COLD DAY'
  },
  {
    path: 'admin/validacion-tecnicos',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    loadComponent: () => import('./modules/administracion/presentation/validacion-tecnicos-page').then(m => m.ValidacionTecnicosPage),
    title: 'Auditoría de Técnicos - COLD DAY'
  },
  {
    path: 'admin/consignaciones',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./modules/administracion/presentation/consignaciones-admin-page').then(m => m.ConsignacionesAdminPage),
    title: 'Conciliación de Consignaciones - COLD DAY'
  },
  {
    path: 'admin/disputas',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    loadComponent: () => import('./modules/administracion/presentation/disputas-admin-page').then(m => m.DisputasAdminPage),
    title: 'Mesa de Mediación - COLD DAY'
  },
  {
    path: 'admin/monitoreo',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./modules/administracion/presentation/monitoreo-ot-page').then(m => m.MonitoreoOtPage),
    title: 'Monitoreo Global de OTs - COLD DAY'
  },

  // Fallback
  {
    path: '**',
    redirectTo: ''
  }
];
