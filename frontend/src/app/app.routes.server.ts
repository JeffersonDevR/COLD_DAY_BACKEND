import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'cliente/ot/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cliente/ot/:id/diagnostico',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cliente/ot/:id/pago',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cliente/ot/:id/calificar',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tecnico/ejecucion/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
