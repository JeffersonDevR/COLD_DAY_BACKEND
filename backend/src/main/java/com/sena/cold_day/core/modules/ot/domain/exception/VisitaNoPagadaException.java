package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * The visit fee has not been paid yet, so the assigned technician cannot start
 * the displacement ({@code ASIGNADA -> EN_CAMINO}, WS5/M6). Mapped to a 409 by
 * {@code OtControllerAdvice}; the aggregate state does NOT advance.
 */
public class VisitaNoPagadaException extends RuntimeException {

    public VisitaNoPagadaException() {
        super("La visita debe estar pagada antes de iniciar el desplazamiento");
    }

    public VisitaNoPagadaException(String mensaje) {
        super(mensaje);
    }
}
