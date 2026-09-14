package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;

/**
 * A dispatch offer cannot be accepted right now: it is unknown, belongs to
 * another technician, or was already resolved. Mapped to HTTP 409 (design D5),
 * the same conflict the cross-offer loser receives.
 */
public class OfertaNoDisponibleException extends RuntimeException {

    public OfertaNoDisponibleException(OfertaOtId id) {
        super("La oferta no esta disponible para aceptacion: " + id);
    }
}
