package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

/**
 * Lifecycle of one supplier offer broadcast for an insumo request (spec
 * disp.R3/R4/R5, design "State Machines"). It mirrors the OT {@code OfertaEstado}
 * plus the spec-mandated {@code RECHAZADO} literal — never {@code RECHAZADA}.
 *
 * <p>{@code PENDIENTE} is the only actionable state. {@code ACEPTADA} is the
 * single atomic winner; every sibling is invalidated to {@code CANCELADA} and an
 * unattended window closes as {@code EXPIRADA}.
 */
public enum OfertaInsumoEstado {

    PENDIENTE,
    ACEPTADA,
    RECHAZADO,
    EXPIRADA,
    CANCELADA;

    /** An offer is actionable only while pending. */
    public boolean estaPendiente() {
        return this == PENDIENTE;
    }

    /**
     * Per-offer terminal states (design Terminal column): the offer is closed
     * and can never transition again. {@code ACEPTADA} is not terminal here
     * because the request lifecycle continues towards {@code ENTREGADO}.
     */
    public boolean esTerminal() {
        return this == RECHAZADO || this == EXPIRADA || this == CANCELADA;
    }
}
