package com.sena.cold_day.core.modules.proveedores.domain.services;

import java.util.Map;
import java.util.Set;

import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;

/**
 * Explicit insumo-request transition table mirroring the design "State Machines"
 * table (the OT {@code TransicionesOt} pattern). Every row names its trigger and
 * actor; states with no outgoing transitions are effectively closed.
 *
 * <pre>
 * Transition                    Trigger                        Actor
 * -&gt; SOLICITADO                 diagnostico with insumos       TECNICO (assigned)
 * SOLICITADO -&gt; ASIGNADO        atomic accept gate             PROVEEDOR
 * ASIGNADO   -&gt; ENTREGADO       delivery confirmed             PROVEEDOR
 * SOLICITADO -&gt; SIN_PROVEEDOR   zero eligible on broadcast     SISTEMA
 * </pre>
 *
 * <p>Expiry is system-driven and per-offer: it closes
 * {@code OfertaInsumoEstado.PENDIENTE -> EXPIRADA} without a root transition, so
 * an unattended request never blocks the OT lifecycle.
 */
public final class TransicionesRequerimiento {

    private static final Map<EstadoRequerimiento, Set<EstadoRequerimiento>> PERMITIDAS = Map.of(
            EstadoRequerimiento.SOLICITADO,
            Set.of(EstadoRequerimiento.ASIGNADO, EstadoRequerimiento.SIN_PROVEEDOR),
            EstadoRequerimiento.ASIGNADO, Set.of(EstadoRequerimiento.ENTREGADO),
            EstadoRequerimiento.ENTREGADO, Set.of(),
            EstadoRequerimiento.SIN_PROVEEDOR, Set.of());

    private TransicionesRequerimiento() {
    }

    /**
     * Validates a transition against the table; illegal transitions raise
     * {@link TransicionRequerimientoInvalidaException}.
     */
    public static void validar(EstadoRequerimiento origen, EstadoRequerimiento destino) {
        if (origen == null || destino == null) {
            throw new IllegalArgumentException("Los estados de origen y destino son requeridos");
        }
        if (!esPermitida(origen, destino)) {
            throw new TransicionRequerimientoInvalidaException(origen, destino);
        }
    }

    public static boolean esPermitida(EstadoRequerimiento origen, EstadoRequerimiento destino) {
        if (origen == null || destino == null) {
            return false;
        }
        return PERMITIDAS.getOrDefault(origen, Set.of()).contains(destino);
    }
}
