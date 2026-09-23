import { buildMenu } from './app.menu';

describe('buildMenu — accesos por rol', () => {
  const rutasDe = (rol: Parameters<typeof buildMenu>[0]) =>
    buildMenu(rol).flatMap((seccion) => seccion.items.map((item) => item.routerLink));

  it('expone el portal de insumos solo al PROVEEDOR', () => {
    const rutas = rutasDe('PROVEEDOR');

    expect(rutas).toContain('/proveedor/panel');
    expect(rutas).not.toContain('/admin/proveedores');
  });

  it('expone la gestión de proveedores solo al ADMINISTRADOR', () => {
    const rutas = rutasDe('ADMINISTRADOR');

    expect(rutas).toContain('/admin/proveedores');
    expect(rutas).not.toContain('/proveedor/panel');
  });

  it('no expone rutas de proveedor a un TECNICO', () => {
    const rutas = rutasDe('TECNICO');

    expect(rutas).not.toContain('/proveedor/panel');
    expect(rutas).not.toContain('/admin/proveedores');
  });
});
