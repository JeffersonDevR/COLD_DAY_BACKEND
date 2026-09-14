package com.sena.cold_day.core.modules.administracion.domain.valueobjects;

/**
 * Ciclo de vida del comprobante de consignacion (RF-F1-24, CU-13):
 * {@code PENDIENTE_CONSIGNACION} tras registrar el pago, {@code EN_VERIFICACION}
 * cuando el tecnico carga la foto, y decision final del administrador.
 */
public enum EstadoLiquidacion {
    PENDIENTE_CONSIGNACION,
    EN_VERIFICACION,
    APROBADA,
    RECHAZADA;

    /** Liquidaciones que mantienen bloqueado al tecnico (RF-F1-23). */
    public boolean bloqueaTecnico() {
        return this == PENDIENTE_CONSIGNACION || this == EN_VERIFICACION || this == RECHAZADA;
    }
}
