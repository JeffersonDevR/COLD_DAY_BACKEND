package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The declared auxiliar count cannot be accepted (spec: Auxiliar Count
 * Validation). Raised before any write, so the offer stays pending and
 * unassigned when the count is negative, non-integer or above the configured
 * maximum (design AD4).
 */
public class ConteoAuxiliaresInvalidoException extends RuntimeException {

    public ConteoAuxiliaresInvalidoException(String message) {
        super(message);
    }
}
