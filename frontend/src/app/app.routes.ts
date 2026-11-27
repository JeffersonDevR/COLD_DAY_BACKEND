import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { guestGuard, recuperarGuard } from './core/guest.guard';
import { roleGuard } from './core/role.guard';
import { PanelRedirectComponent } from './core/navihationError/panel-redirect';

export const routes: Routes = [
  // La landing pública vive en un proyecto separado (landing/); la app arranca en login.
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login-page/login-page').then(m => m.LoginPage),
    title: 'Ingreso al Sistema - COLD DAY'
  },
  {
    path: 'recuperar',
    canActivate: [recuperarGuard],
    loadComponent: () => import('./pages/recuperar-page/recuperar-page').then(m => m.RecuperarPage),
    title: 'Recuperar Contraseña - COLD DAY'
  },

  // Redirección inteligente de Panel
  {
    path: 'panel',
    canActivate: [authGuard],
    component: PanelRedirectComponent
  },

  // Cuentas sin rol interno: sus funciones viven en la app móvil.
  {
    path: 'usa-la-app',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/usa-la-app-page/usa-la-app-page').then(m => m.UsaLaAppPage),
    title: 'Usa la app - COLD DAY'
  },

  // Rutas Administrativas y Contables
  {
    path: 'admin/dashboard',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./pages/dashboard-admin-page/dashboard-admin-page').then(m => m.DashboardAdminPage),
    title: 'Torre de Control Administrativa - COLD DAY'
  },
  {
    path: 'admin/validacion-tecnicos',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    loadComponent: () => import('./pages/validacion-tecnicos-page/validacion-tecnicos-page').then(m => m.ValidacionTecnicosPage),
    title: 'Auditoría de Técnicos - COLD DAY'
  },
  {
    path: 'admin/consignaciones',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./pages/consignaciones-admin-page/consignaciones-admin-page').then(m => m.ConsignacionesAdminPage),
    title: 'Conciliación de Consignaciones - COLD DAY'
  },
  {
    path: 'admin/disputas',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    loadComponent: () => import('./pages/disputas-admin-page/disputas-admin-page').then(m => m.DisputasAdminPage),
    title: 'Mesa de Mediación - COLD DAY'
  },
  {
    path: 'admin/monitoreo',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./pages/monitoreo-ot-page/monitoreo-ot-page').then(m => m.MonitoreoOtPage),
    title: 'Monitoreo Global de OTs - COLD DAY'
  },
  {
    path: 'admin/ot/:id',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])],
    loadComponent: () => import('./pages/admin-ot-detalle-page/admin-ot-detalle-page').then(m => m.AdminOtDetallePage),
    title: 'Detalle de OT - COLD DAY'
  },
  {
    path: 'admin/proveedores',
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    loadComponent: () => import('./pages/proveedores-admin-page/proveedores-admin-page').then(m => m.ProveedoresAdminPage),
    title: 'Proveedores Auxiliares - COLD DAY'
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'login'
  }
];
