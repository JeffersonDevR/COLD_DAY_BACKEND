package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * OT lifecycle states (SRS §5.2, design D1/D2). {@code DISPUTADA} is the
 * mediation state of RF-F1-25: the client rejected the diagnosis or the
 * delivered work and only the administrator can resolve it towards
 * {@link #FINALIZADA} (agreement) or {@link #CANCELADA} (no agreement).
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
    SIN_TECNICOS_DISPONIBLES,
    DISPUTADA;

    /** Terminal states have no outgoing transitions (design D2). */
    public boolean esTerminal() {
        return this == FINALIZADA || this == CANCELADA || this == SIN_TECNICOS_DISPONIBLES;
    }
}
