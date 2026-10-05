package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The signature payload is malformed: blank, or larger than the accepted limit.
 * A 400, not a 409: the request itself is wrong, the order state is irrelevant.
 */
public class FirmaActaInvalidaException extends RuntimeException {

    public FirmaActaInvalidaException(String message) {
        super(message);
    }
}
