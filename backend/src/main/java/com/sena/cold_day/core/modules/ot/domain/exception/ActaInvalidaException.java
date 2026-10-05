package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The warranty acta cannot be accepted. Raised by
 * {@code Ot.registrarActaGarantia} when the OT is not FINALIZADA or when it
 * already carries a signed acta.
 *
 * <p>Same shape as {@link CalificacionInvalidaException}: a conflict with the
 * state of the order, mapped to 409 with the state left untouched.
 */
public class ActaInvalidaException extends RuntimeException {

    public ActaInvalidaException(String message) {
        super(message);
    }
}
