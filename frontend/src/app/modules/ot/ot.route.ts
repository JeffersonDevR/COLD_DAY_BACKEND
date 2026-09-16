import { Routes } from '@angular/router';

export const OT_ROUTES: Routes = [
  {
    path: '',
    title: 'Monitoreo de OT · COLD DAY',
    loadComponent: () =>
      import('./presentation/pages/monitoreo-ot.page').then((m) => m.MonitoreoPage),
  },
  {
    path: ':id',
    title: 'Detalle de OT · COLD DAY',
    loadComponent: () =>
      import('./presentation/pages/detalle-ot.page').then((m) => m.DetalleOtPage),
  },
];
