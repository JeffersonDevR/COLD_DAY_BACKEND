import { buildMenu } from './app.menu';

describe('buildMenu — accesos por rol', () => {
  const rutasDe = (rol: Parameters<typeof buildMenu>[0]) =>
    buildMenu(rol).flatMap((seccion) => seccion.items.map((item) => item.routerLink));

  it('devuelve vacío sin rol', () => {
    expect(buildMenu(null)).toEqual([]);
  });

  it('muestra las rutas de cliente', () => {
    expect(rutasDe('CLIENTE')).toEqual(['/cliente/panel', '/cliente/solicitar', '/cliente/equipos']);
  });

  it('muestra la sección técnica y la comisión', () => {
    const menu = buildMenu('TECNICO');
    expect(menu).toHaveLength(1);
    expect(menu[0].items).toHaveLength(4);
    expect(menu[0].items[3].label).toContain('Liquidaciones (');
  });

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

  it('el administrador conserva el resto de sus accesos administrativos', () => {
    expect(rutasDe('ADMINISTRADOR')).toEqual(expect.arrayContaining([
      '/admin/dashboard', '/admin/consignaciones', '/admin/validacion-tecnicos',
      '/admin/disputas', '/admin/monitoreo', '/admin/proveedores',
    ]));
  });

  it('el contable solo ve sus pantallas permitidas', () => {
    expect(rutasDe('CONTABLE')).toEqual(['/admin/dashboard', '/admin/consignaciones', '/admin/monitoreo']);
  });

  it('no expone rutas de proveedor a un TECNICO', () => {
    const rutas = rutasDe('TECNICO');

    expect(rutas).not.toContain('/proveedor/panel');
    expect(rutas).not.toContain('/admin/proveedores');
  });
});
