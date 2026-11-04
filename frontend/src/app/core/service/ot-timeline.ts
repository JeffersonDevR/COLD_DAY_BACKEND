import { EstadoOt } from '../models/common.models';

/**
 * Timeline del ciclo operativo de la OT (web A6 y móvil A6).
 *
 * Vive en `core` porque las dos apps pintan el mismo paso a paso: una regla
 * duplicada es una regla que se desincroniza en silencio. La función es pura:
 * recibe el estado actual y devuelve los siete pasos con sus marcas; el
 * historial de auditoría se renderiza aparte en cada app.
 */

export interface TimelinePaso {
  estado: EstadoOt;
  label: string;
  icon: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

/** Orden estándar del ciclo operativo. */
export const ORDEN_TIMELINE: readonly EstadoOt[] = [
  'SOLICITADA',
  'BUSCANDO_TECNICO',
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
  'FINALIZADA',
];

/**
 * Calcula los siete pasos del ciclo a partir del estado actual.
 *
 * `currentIndex === -1` (CANCELADA, DISPUTADA, SIN_TECNICOS_DISPONIBLES) deja
 * todos los pasos como no completados y sin paso actual, igual que la versión
 * original del componente web: una OT cerrada fuera del ciclo feliz no avanza
 * por él.
 */
export function calcularPasosTimeline(estadoActual: EstadoOt): TimelinePaso[] {
  const currentIndex = ORDEN_TIMELINE.indexOf(estadoActual);

  return [
    {
      estado: 'SOLICITADA',
      label: 'Solicitada',
      icon: 'file-plus',
      isCompleted: currentIndex >= 0,
      isCurrent: estadoActual === 'SOLICITADA',
    },
    {
      estado: 'BUSCANDO_TECNICO',
      label: 'Buscando',
      icon: 'compass',
      isCompleted: currentIndex >= 1,
      isCurrent: estadoActual === 'BUSCANDO_TECNICO',
    },
    {
      estado: 'ASIGNADA',
      label: 'Asignada',
      icon: 'user',
      isCompleted: currentIndex >= 2,
      isCurrent: estadoActual === 'ASIGNADA',
    },
    {
      estado: 'EN_CAMINO',
      label: 'En Camino',
      icon: 'truck',
      isCompleted: currentIndex >= 3,
      isCurrent: estadoActual === 'EN_CAMINO',
    },
    {
      estado: 'EN_DIAGNOSTICO',
      label: 'Diagnóstico',
      icon: 'wrench',
      isCompleted: currentIndex >= 4,
      isCurrent: estadoActual === 'EN_DIAGNOSTICO',
    },
    {
      estado: 'EN_REPARACION',
      label: 'Reparación',
      icon: 'hammer',
      isCompleted: currentIndex >= 5,
      isCurrent: estadoActual === 'EN_REPARACION',
    },
    {
      estado: 'FINALIZADA',
      label: 'Finalizada',
      icon: 'verified',
      isCompleted: currentIndex === 6 || estadoActual === 'FINALIZADA',
      isCurrent: estadoActual === 'FINALIZADA',
    },
  ];
}
