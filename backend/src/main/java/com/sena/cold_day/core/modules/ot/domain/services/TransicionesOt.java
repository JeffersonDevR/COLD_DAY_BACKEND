package com.sena.cold_day.core.modules.ot.domain.services;

import java.util.Map;
import java.util.Set;

import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Explicit OT transition table mirroring SRS §5.2 (design D1). A single
 * validated table keeps every guard and RNF-09 audit path in one place.
 *
 * <p>{@code CANCELADA} is no longer strictly terminal (RF-F1-20/26): its ONLY
 * permitted exit is the paid-visit reopen ({@code CANCELADA -> BUSCANDO_TECNICO}).
 * That edge is declared here, but it is deliberately permissive: a static table
 * cannot express the cancellation motive, so the real business gate (motive
 * {@code RECHAZO_PRESUPUESTO} plus a recorded visit payment) lives in
 * {@code Ot.reabrirDespachoTrasPagoVisita}. The generic {@code Ot.iniciarBusqueda}
 * refuses any origin other than {@code SOLICITADA}, so this permissive edge is
 * unreachable except through that guarded method. {@code FINALIZADA} and
 * {@code SIN_TECNICOS_DISPONIBLES} remain terminal.
 */
public final class TransicionesOt {

    private static final Map<EstadoOt, Set<EstadoOt>> PERMITIDAS = Map.ofEntries(
            Map.entry(EstadoOt.SOLICITADA, Set.of(EstadoOt.BUSCANDO_TECNICO)),
            Map.entry(EstadoOt.BUSCANDO_TECNICO,
                    Set.of(EstadoOt.ASIGNADA, EstadoOt.SIN_TECNICOS_DISPONIBLES, EstadoOt.CANCELADA)),
            Map.entry(EstadoOt.ASIGNADA, Set.of(EstadoOt.EN_CAMINO, EstadoOt.CANCELADA)),
            Map.entry(EstadoOt.EN_CAMINO, Set.of(EstadoOt.EN_DIAGNOSTICO, EstadoOt.CANCELADA)),
            Map.entry(EstadoOt.EN_DIAGNOSTICO,
                    Set.of(EstadoOt.EN_REPARACION, EstadoOt.CANCELADA, EstadoOt.DISPUTADA)),
            Map.entry(EstadoOt.EN_REPARACION, Set.of(EstadoOt.FINALIZADA, EstadoOt.DISPUTADA)),
            Map.entry(EstadoOt.DISPUTADA, Set.of(EstadoOt.FINALIZADA, EstadoOt.CANCELADA)),
            Map.entry(EstadoOt.FINALIZADA, Set.of()),
            Map.entry(EstadoOt.CANCELADA, Set.of(EstadoOt.BUSCANDO_TECNICO)),
            Map.entry(EstadoOt.SIN_TECNICOS_DISPONIBLES, Set.of()));

    private TransicionesOt() {
    }

    /**
     * Validates a transition against the table; illegal transitions raise
     * {@link TransicionOtInvalidaException}.
     */
    public static void validar(EstadoOt origen, EstadoOt destino) {
        if (origen == null || destino == null) {
            throw new IllegalArgumentException("Los estados de origen y destino son requeridos");
        }
        if (!esPermitida(origen, destino)) {
            throw new TransicionOtInvalidaException(origen, destino);
        }
    }

    public static boolean esPermitida(EstadoOt origen, EstadoOt destino) {
        if (origen == null || destino == null) {
            return false;
        }
        return PERMITIDAS.getOrDefault(origen, Set.of()).contains(destino);
    }
}
