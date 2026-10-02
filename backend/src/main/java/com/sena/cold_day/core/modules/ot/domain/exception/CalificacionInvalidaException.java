package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The technician rating cannot be accepted (RF-F1-15). Raised before any write
 * when the OT is not {@code FINALIZADA}, when the score falls outside the 1..5
 * scale, when no technician served the order, or when the OT was already rated
 * once (design AD8).
 */
public class CalificacionInvalidaException extends RuntimeException {

    public CalificacionInvalidaException(String message) {
        super(message);
    }
}
