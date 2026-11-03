import type {Route, Routes} from '@angular/router';

/** Placeholder screen for a mobile mode that is not implemented yet (P0). */
const placeholder = (title: string, description: string): Route => ({
  title: `${title} · Cold Day`,
  data: {title, description},
  loadComponent: () => import('./pages/placeholder.page').then((m) => m.PlaceholderPage),
});

export const routes: Routes = [
  {path: '', pathMatch: 'full', redirectTo: 'login'},
  {
    path: 'login',
    title: 'Ingresar · Cold Day',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      {path: '', pathMatch: 'full', redirectTo: 'cliente'},
      {path: 'cliente', ...placeholder('Cliente', 'Panel del cliente: solicitudes, equipos y seguimiento de OT.')},
      {path: 'tecnico', ...placeholder('Técnico', 'Radar de ofertas, mis OTs y perfil técnico.')},
      {path: 'proveedor', ...placeholder('Proveedor', 'Solicitudes de insumos y documentos del proveedor.')},
    ],
  },
  {path: '**', redirectTo: 'login'},
];
