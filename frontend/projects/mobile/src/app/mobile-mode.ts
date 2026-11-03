import type {Rol} from '@core/models/common.models';

/** Roles covered by the mobile app (admin stays on the web panel). */
export type MobileRol = Extract<Rol, 'CLIENTE' | 'TECNICO' | 'PROVEEDOR'>;

export interface MobileTab {
  readonly rol: MobileRol;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
}

/**
 * Placeholder tabs for P0. The real per-role navigation (cliente: Panel /
 * Servicio / Cuenta, tecnico: Radar / Mis OTs / Perfil, proveedor: Insumos /
 * Documentos / Cuenta) arrives in P1, gated by the mode selector.
 */
export const MOBILE_TABS: readonly MobileTab[] = [
  {rol: 'CLIENTE', label: 'Cliente', icon: 'home-outline', path: '/tabs/cliente'},
  {rol: 'TECNICO', label: 'Técnico', icon: 'construct-outline', path: '/tabs/tecnico'},
  {rol: 'PROVEEDOR', label: 'Proveedor', icon: 'cube-outline', path: '/tabs/proveedor'},
];
