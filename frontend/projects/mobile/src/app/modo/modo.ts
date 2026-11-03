import type { Rol } from '@core/models/common.models';

/**
 * Modos de la app móvil. Es el mismo eje que los roles operativos del backend,
 * salvo que admin y contable quedan fuera: esas cuentas siguen en la web.
 */
export type ModoApp = 'CLIENTE' | 'TECNICO' | 'PROVEEDOR';

export interface ModoTab {
  /** Id del tab: debe coincidir con el segmento de ruta bajo el modo. */
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

export interface ModoConfig {
  readonly modo: ModoApp;
  /** Ruta absoluta del home del modo. */
  readonly home: string;
  readonly tabs: readonly ModoTab[];
}

/**
 * Prioridad de modos cuando el usuario tiene varios perfiles y todavía no
 * eligió: cliente primero (el flujo más frecuente), después técnico y proveedor.
 */
export const ORDEN_MODOS: readonly ModoApp[] = ['CLIENTE', 'TECNICO', 'PROVEEDOR'];

export const MODOS: Record<ModoApp, ModoConfig> = {
  CLIENTE: {
    modo: 'CLIENTE',
    home: '/cliente/panel',
    tabs: [
      { id: 'panel', label: 'Panel', icon: 'home-outline' },
      { id: 'equipos', label: 'Equipos', icon: 'cube-outline' },
      { id: 'cuenta', label: 'Cuenta', icon: 'person-outline' },
    ],
  },
  TECNICO: {
    modo: 'TECNICO',
    home: '/tecnico/radar',
    tabs: [
      { id: 'radar', label: 'Radar', icon: 'radio-outline' },
      { id: 'ots', label: 'Mis OTs', icon: 'construct-outline' },
      { id: 'liquidaciones', label: 'Liquidaciones', icon: 'cash-outline' },
      { id: 'cuenta', label: 'Cuenta', icon: 'person-outline' },
    ],
  },
  PROVEEDOR: {
    modo: 'PROVEEDOR',
    home: '/proveedor/insumos',
    tabs: [
      { id: 'insumos', label: 'Insumos', icon: 'cube-outline' },
      { id: 'documentos', label: 'Documentos', icon: 'document-text-outline' },
      { id: 'cuenta', label: 'Cuenta', icon: 'person-outline' },
    ],
  },
};

/** Ruta home del modo, o `null` si el valor no es un modo válido. */
export function rutaHome(modo: ModoApp): string {
  return MODOS[modo].home;
}

export function esModoApp(valor: unknown): valor is ModoApp {
  return typeof valor === 'string' && (ORDEN_MODOS as readonly string[]).includes(valor);
}

/** `true` si el rol del backend tiene una pantalla en la app móvil. */
export function esRolDeModo(rol: Rol): rol is ModoApp {
  return esModoApp(rol);
}
