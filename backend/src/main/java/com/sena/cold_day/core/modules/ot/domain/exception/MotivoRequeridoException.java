package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * A cancellation was submitted without the mandatory reason (RF-F1-21).
 * Mapped to 400; the OT state is left unchanged.
 */
public class MotivoRequeridoException extends RuntimeException {

    public MotivoRequeridoException() {
        super("La razon de cancelacion es requerida");
    }
}
