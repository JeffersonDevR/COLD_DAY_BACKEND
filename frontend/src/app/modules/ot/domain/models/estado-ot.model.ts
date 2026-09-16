export type EstadoOt =
  | 'SOLICITADA'
  | 'BUSCANDO_TECNICO'
  | 'ASIGNADA'
  | 'EN_CAMINO'
  | 'EN_DIAGNOSTICO'
  | 'EN_REPARACION'
  | 'FINALIZADA'
  | 'SIN_TECNICOS_DISPONIBLES'
  | 'DISPUTADA'
  | 'CANCELADA';

export type ActorOt = 'CLIENTE' | 'TECNICO' | 'ADMINISTRADOR' | 'SISTEMA';

export const ETIQUETA_ESTADO_OT: Record<EstadoOt, string> = {
  SOLICITADA: 'Solicitada',
  BUSCANDO_TECNICO: 'Buscando técnico',
  ASIGNADA: 'Asignada',
  EN_CAMINO: 'En camino',
  EN_DIAGNOSTICO: 'En diagnóstico',
  EN_REPARACION: 'En reparación',
  FINALIZADA: 'Finalizada',
  SIN_TECNICOS_DISPONIBLES: 'Sin técnicos disponibles',
  DISPUTADA: 'Disputada',
  CANCELADA: 'Cancelada',
};

export const CLASE_ESTADO_OT: Record<EstadoOt, string> = {
  SOLICITADA: 'bg-slate-100 text-slate-700 ring-slate-300',
  BUSCANDO_TECNICO: 'bg-amber-100 text-amber-800 ring-amber-300',
  ASIGNADA: 'bg-sky-100 text-sky-800 ring-sky-300',
  EN_CAMINO: 'bg-cyan-100 text-cyan-800 ring-cyan-300',
  EN_DIAGNOSTICO: 'bg-indigo-100 text-indigo-800 ring-indigo-300',
  EN_REPARACION: 'bg-violet-100 text-violet-800 ring-violet-300',
  FINALIZADA: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  SIN_TECNICOS_DISPONIBLES: 'bg-orange-100 text-orange-800 ring-orange-300',
  DISPUTADA: 'bg-rose-100 text-rose-800 ring-rose-300',
  CANCELADA: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const ORDEN_ESTADOS_OT: readonly EstadoOt[] = [
  'SOLICITADA',
  'BUSCANDO_TECNICO',
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
  'FINALIZADA',
  'DISPUTADA',
  'SIN_TECNICOS_DISPONIBLES',
  'CANCELADA',
];

export const ESTADOS_TERMINALES: readonly EstadoOt[] = [
  'FINALIZADA',
  'CANCELADA',
  'SIN_TECNICOS_DISPONIBLES',
];

export const TRANSICIONES_OT: Record<EstadoOt, readonly EstadoOt[]> = {
  SOLICITADA: ['BUSCANDO_TECNICO', 'CANCELADA'],
  BUSCANDO_TECNICO: ['ASIGNADA', 'SIN_TECNICOS_DISPONIBLES', 'CANCELADA'],
  ASIGNADA: ['EN_CAMINO', 'CANCELADA'],
  EN_CAMINO: ['EN_DIAGNOSTICO', 'CANCELADA'],
  EN_DIAGNOSTICO: ['EN_REPARACION', 'DISPUTADA', 'CANCELADA'],
  EN_REPARACION: ['FINALIZADA', 'DISPUTADA'],
  FINALIZADA: [],
  SIN_TECNICOS_DISPONIBLES: [],
  DISPUTADA: ['FINALIZADA', 'CANCELADA'],
  CANCELADA: [],
};

export function esEstadoTerminal(estado: EstadoOt): boolean {
  return ESTADOS_TERMINALES.includes(estado);
}

export function puedeTransicionar(desde: EstadoOt, hacia: EstadoOt): boolean {
  return TRANSICIONES_OT[desde].includes(hacia);
}
