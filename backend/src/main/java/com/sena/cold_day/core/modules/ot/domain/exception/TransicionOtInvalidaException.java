package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Raised when an OT transition is not part of the SRS §5.2 state machine
 * (design D1). Mapped to HTTP 409 by the REST advice.
 */
public class TransicionOtInvalidaException extends RuntimeException {

    public TransicionOtInvalidaException(EstadoOt origen, EstadoOt destino) {
        super("Transicion de OT invalida: " + origen + " -> " + destino);
    }
}
