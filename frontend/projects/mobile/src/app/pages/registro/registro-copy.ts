import type { Rol } from '@core/models/common.models';

/** Roles que la app móvil puede crear por autoservicio. */
export type RolAlta = Extract<Rol, 'CLIENTE' | 'TECNICO' | 'PROVEEDOR'>;

/**
 * 409 en el alta: el status solo dice "conflicto", no la causa.
 *
 * Es un espejo del `copyConflictoAlta` de
 * `src/app/pages/registro-page/registro-page.ts`. No se importa desde allá
 * porque ese módulo importa el `ToastService` de PrimeNG y arrastraría PrimeNG
 * al bundle móvil. Si cambia el copy de la web, cambia acá: cliente solo puede
 * chocar por correo; técnico y proveedor también por su campo único, así que no
 * se afirma cuál fue.
 */
const CAMPO_UNICO_POR_ROL: Partial<Record<RolAlta, string>> = {
  TECNICO: 'tu número de identificación',
  PROVEEDOR: 'el NIT de tu empresa',
};

export function copyConflictoAlta(rol: RolAlta): string {
  if (rol === 'CLIENTE') {
    return 'Ya existe una cuenta con ese correo. Iniciá sesión o recuperá tu contraseña.';
  }
  const campo = CAMPO_UNICO_POR_ROL[rol];
  return campo
    ? `Ya existe una cuenta con ese correo o ${campo} ya está registrado. Revisá los datos o iniciá sesión si ya tenés cuenta.`
    : 'Ya existe una cuenta con ese correo o un dato único ya registrado. Revisá los datos o iniciá sesión si ya tenés cuenta.';
}
