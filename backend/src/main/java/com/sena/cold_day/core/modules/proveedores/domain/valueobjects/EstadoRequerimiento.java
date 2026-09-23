package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

/**
 * Lifecycle of an insumo request raised from a technician's diagnóstico (spec
 * disp.R1/R3/R6/R7, design "State Machines").
 *
 * <p>{@code SOLICITADO -> ASIGNADO -> ENTREGADO} is the happy path and
 * {@code SOLICITADO -> SIN_PROVEEDOR} is the negative branch when the broadcast
 * finds zero eligible suppliers. {@code SIN_PROVEEDOR} is terminal-but-retriable:
 * the request stays unresolved and the OT lifecycle is never blocked.
 *
 * <p>{@code CANCELADO} is deliberately absent: nothing in the four specs can
 * reach a cancelled root, so declaring it would leave an unreachable state.
 * Per-offer invalidation lives on {@link OfertaInsumoEstado#CANCELADA} instead.
 */
public enum EstadoRequerimiento {

    SOLICITADO,
    ASIGNADO,
    ENTREGADO,
    SIN_PROVEEDOR;

    /**
     * Only a delivered request is final; {@code SIN_PROVEEDOR} stays retriable
     * (design Terminal column: "retriable"), so it is not a hard terminal.
     */
    public boolean esTerminal() {
        return this == ENTREGADO;
    }
}
