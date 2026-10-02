package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The arrival confirmation cannot be accepted (spec: Visit Tracking). Raised
 * before any write when the OT is not in {@code EN_CAMINO} or when no
 * technician is assigned, because there is nobody whose arrival could be
 * confirmed (design AD6).
 */
public class ConfirmarLlegadaInvalidaException extends RuntimeException {

    public ConfirmarLlegadaInvalidaException(String message) {
        super(message);
    }
}
