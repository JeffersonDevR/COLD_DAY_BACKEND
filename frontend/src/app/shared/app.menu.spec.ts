import { buildMenu } from './app.menu';

describe('buildMenu — accesos por rol', () => {
  const rutasDe = (roles: Parameters<typeof buildMenu>[0]) =>
    buildMenu(roles).flatMap((seccion) => seccion.items.map((item) => item.routerLink));

  it('devuelve vacío sin roles', () => {
    expect(buildMenu(null)).toEqual([]);
    expect(buildMenu([])).toEqual([]);
  });

  it('muestra las rutas de cliente', () => {
    expect(rutasDe(['CLIENTE'])).toEqual(['/cliente/panel', '/cliente/solicitar', '/cliente/equipos']);
  });

  it('muestra la sección técnica y la comisión', () => {
    const menu = buildMenu(['TECNICO']);
    const seccionTecnica = menu.find((s) => s.label === 'Técnico');

    expect(seccionTecnica).toBeDefined();
    expect(seccionTecnica!.items).toHaveLength(5);
    expect(seccionTecnica!.items[0].routerLink).toBe('/tecnico/perfil');
    expect(seccionTecnica!.items[4].label).toContain('Liquidaciones (');
  });

  it('un usuario con doble rol ve AMBAS secciones, sin selector "act as"', () => {
    const menu = buildMenu(['CLIENTE', 'TECNICO']);

    expect(menu.map((seccion) => seccion.label)).toEqual(['Cliente', 'Técnico']);
    const rutas = menu.flatMap((seccion) => seccion.items.map((item) => item.routerLink));
    expect(rutas).toContain('/cliente/panel');
    expect(rutas).toContain('/tecnico/perfil');
  });

  it('expone el portal de insumos solo al PROVEEDOR', () => {
    const rutas = rutasDe(['PROVEEDOR']);

    expect(rutas).toContain('/proveedor/panel');
    expect(rutas).not.toContain('/admin/proveedores');
  });

  it('expone la gestión de proveedores solo al ADMINISTRADOR', () => {
    const rutas = rutasDe(['ADMINISTRADOR']);

    expect(rutas).toContain('/admin/proveedores');
    expect(rutas).not.toContain('/proveedor/panel');
  });

  it('el administrador conserva el resto de sus accesos administrativos', () => {
    expect(rutasDe(['ADMINISTRADOR'])).toEqual(expect.arrayContaining([
      '/admin/dashboard', '/admin/consignaciones', '/admin/validacion-tecnicos',
      '/admin/disputas', '/admin/monitoreo', '/admin/proveedores',
    ]));
  });

  it('el contable solo ve sus pantallas permitidas', () => {
    expect(rutasDe(['CONTABLE'])).toEqual(['/admin/dashboard', '/admin/consignaciones', '/admin/monitoreo']);
  });

  it('no expone rutas de proveedor a un TECNICO', () => {
    const rutas = rutasDe(['TECNICO']);

    expect(rutas).not.toContain('/proveedor/panel');
    expect(rutas).not.toContain('/admin/proveedores');
  });
});
