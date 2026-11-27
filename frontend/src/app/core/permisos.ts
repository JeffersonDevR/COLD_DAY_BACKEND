import { Rol } from './models/common.models';

/** Lo que se puede hacer en el panel. Espeja `Permiso.java`. */
export type Permiso =
  | 'VER_OPERACION'
  | 'GESTIONAR_CONSIGNACIONES'
  | 'VER_TECNICOS'
  | 'VALIDAR_DOCUMENTACION'
  | 'GESTIONAR_DISPUTAS'
  | 'GESTIONAR_CUENTAS';

/**
 * Único mapa rol → permisos de la web. Debe coincidir con `PermisosPorRol.java`:
 * de aquí salen menú, rutas, pantalla de inicio y roles que se pueden crear.
 * El backend sigue siendo la autoridad.
 */
export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  ADMINISTRADOR: [
    'VER_OPERACION', 'GESTIONAR_CONSIGNACIONES', 'VER_TECNICOS',
    'VALIDAR_DOCUMENTACION', 'GESTIONAR_DISPUTAS', 'GESTIONAR_CUENTAS',
  ],
  CONTABLE: ['VER_OPERACION', 'GESTIONAR_CONSIGNACIONES', 'VER_TECNICOS'],
  RECURSOS_HUMANOS: ['VER_TECNICOS', 'VALIDAR_DOCUMENTACION'],
  CLIENTE: [],
  TECNICO: [],
  PROVEEDOR: [],
};

const ROLES = Object.keys(PERMISOS_POR_ROL) as Rol[];

export function rolesCon(permiso: Permiso): Rol[] {
  return ROLES.filter((rol) => PERMISOS_POR_ROL[rol].includes(permiso));
}

export function tienePermiso(roles: Iterable<Rol>, permiso: Permiso): boolean {
  return [...roles].some((rol) => PERMISOS_POR_ROL[rol]?.includes(permiso));
}

/** Roles que el administrador puede crear desde el panel. */
export function rolesGestionables(): Rol[] {
  return ROLES.filter((rol) => rol !== 'ADMINISTRADOR' && PERMISOS_POR_ROL[rol].length > 0);
}
