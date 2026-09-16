import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ot' },
  {
    path: 'ot',
    loadChildren: () => import('./modules/ot/ot.route').then((m) => m.OT_ROUTES),
  },
  { path: '**', redirectTo: 'ot' },
];
