import { buildMenu } from './app.menu';

describe('buildMenu — accesos internos por rol', () => {
  const rutasDe = (roles: Parameters<typeof buildMenu>[0]) =>
    buildMenu(roles).flatMap((seccion) => seccion.items.map((item) => item.routerLink));

  it('devuelve vacío sin roles', () => {
    expect(buildMenu(null)).toEqual([]);
    expect(buildMenu([])).toEqual([]);
  });

  it('cliente, técnico y proveedor no tienen menú en la web', () => {
    expect(buildMenu(['CLIENTE', 'TECNICO', 'PROVEEDOR'])).toEqual([]);
  });

  it('el administrador ve todos los accesos administrativos', () => {
    expect(rutasDe(['ADMINISTRADOR'])).toEqual([
      '/admin/dashboard', '/admin/consignaciones', '/admin/validacion-tecnicos',
      '/admin/disputas', '/admin/monitoreo', '/admin/proveedores',
    ]);
  });

  it('el contable solo ve sus pantallas permitidas', () => {
    expect(rutasDe(['CONTABLE'])).toEqual(['/admin/dashboard', '/admin/consignaciones', '/admin/monitoreo']);
  });
});
