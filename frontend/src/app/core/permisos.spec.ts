import { PERMISOS_POR_ROL, rolesCon, rolesGestionables, tienePermiso } from './permisos';

describe('permisos', () => {
  it('cada rol tiene los permisos que define el backend', () => {
    expect(PERMISOS_POR_ROL.ADMINISTRADOR).toEqual([
      'VER_OPERACION', 'GESTIONAR_CONSIGNACIONES', 'VER_TECNICOS',
      'VALIDAR_DOCUMENTACION', 'GESTIONAR_DISPUTAS', 'GESTIONAR_CUENTAS',
    ]);
    expect(PERMISOS_POR_ROL.CONTABLE).toEqual(['VER_OPERACION', 'GESTIONAR_CONSIGNACIONES', 'VER_TECNICOS']);
    expect(PERMISOS_POR_ROL.RECURSOS_HUMANOS).toEqual(['VER_TECNICOS', 'VALIDAR_DOCUMENTACION']);
    for (const rol of ['CLIENTE', 'TECNICO', 'PROVEEDOR'] as const) {
      expect(PERMISOS_POR_ROL[rol]).toEqual([]);
    }
  });

  it('dice qué roles tienen un permiso y cuáles se pueden crear', () => {
    expect(rolesCon('VALIDAR_DOCUMENTACION')).toEqual(['ADMINISTRADOR', 'RECURSOS_HUMANOS']);
    expect(rolesGestionables()).toEqual(['CONTABLE', 'RECURSOS_HUMANOS']);
    expect(tienePermiso(new Set(['CLIENTE', 'CONTABLE']), 'VER_OPERACION')).toBe(true);
    expect(tienePermiso(['RECURSOS_HUMANOS'], 'GESTIONAR_DISPUTAS')).toBe(false);
  });
});
