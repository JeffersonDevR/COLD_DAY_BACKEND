import { routes } from './app.routes';

describe('rutas de la web', () => {
  it('la web solo expone acceso y administración', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '', 'login', 'recuperar', 'panel', 'usa-la-app',
      'admin/dashboard', 'admin/validacion-tecnicos', 'admin/consignaciones',
      'admin/disputas', 'admin/monitoreo', 'admin/ot/:id', 'admin/proveedores', '**',
    ]);
  });

  it('una ruta retirada cae en la raíz en vez de quedar en blanco', () => {
    expect(routes.at(-1)).toMatchObject({ path: '**', redirectTo: '' });
  });
});
