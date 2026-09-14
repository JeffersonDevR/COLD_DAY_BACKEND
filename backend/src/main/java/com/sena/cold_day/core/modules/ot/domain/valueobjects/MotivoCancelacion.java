package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * Reason that terminated an OT as {@link EstadoOt#CANCELADA} (design D2).
 * Client budget rejection maps to {@link #RECHAZO_PRESUPUESTO} (RF-F1-20).
 */
public enum MotivoCancelacion {
    CANCELACION_CLIENTE, CANCELACION_TECNICO, RECHAZO_PRESUPUESTO, RESOLUCION_DISPUTA_SIN_ACUERDO
}
