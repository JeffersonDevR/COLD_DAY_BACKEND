package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * OT lifecycle states (SRS §5.2, design D1/D2). {@code DISPUTADA} is
 * intentionally absent: disputes are deferred with RF-F1-25 and client
 * rejection terminates the OT as {@link #CANCELADA} (RF-F1-20).
 */
public enum EstadoOt {

    SOLICITADA,
    BUSCANDO_TECNICO,
    ASIGNADA,
    EN_CAMINO,
    EN_DIAGNOSTICO,
    EN_REPARACION,
    FINALIZADA,
    CANCELADA,
    SIN_TECNICOS_DISPONIBLES;

    /** Terminal states have no outgoing transitions (design D2). */
    public boolean esTerminal() {
        return this == FINALIZADA || this == CANCELADA || this == SIN_TECNICOS_DISPONIBLES;
    }
}
