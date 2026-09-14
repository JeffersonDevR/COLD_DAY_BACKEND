package com.sena.cold_day.core.modules.administracion.domain.valueobjects;

/**
 * Medio de pago recibido directamente por el tecnico al cierre de la OT
 * (RF-F1-26). La pasarela digital llegara en Fase 2 (RF-F2-01).
 */
public enum MedioPago {
    EFECTIVO,
    TRANSFERENCIA
}
