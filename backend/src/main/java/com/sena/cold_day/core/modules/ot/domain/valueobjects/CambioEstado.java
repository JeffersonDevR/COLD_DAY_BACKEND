package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable record of a single OT state change (RNF-09). {@code origen} is
 * {@code null} for the creation entry, which lands directly in
 * {@link EstadoOt#SOLICITADA}.
 */
public record CambioEstado(
        EstadoOt origen,
        EstadoOt destino,
        ActorOt actor,
        Instant ocurridoEn,
        String motivo) {

    public CambioEstado {
        Objects.requireNonNull(destino, "El estado destino es requerido");
        Objects.requireNonNull(actor, "El actor es requerido");
        Objects.requireNonNull(ocurridoEn, "El momento del cambio es requerido");
    }

    public static CambioEstado hacia(EstadoOt origen, EstadoOt destino, ActorOt actor, Instant ocurridoEn) {
        return new CambioEstado(origen, destino, actor, ocurridoEn, null);
    }
}
