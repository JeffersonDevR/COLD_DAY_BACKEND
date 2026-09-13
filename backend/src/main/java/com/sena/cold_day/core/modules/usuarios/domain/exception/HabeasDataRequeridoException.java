package com.sena.cold_day.core.modules.usuarios.domain.exception;

/**
 * Thrown when registration is attempted without explicit Habeas Data consent.
 * Consent is a mandatory invariant of {@code Usuario.registrar(...)}, so the
 * domain rejects the operation instead of capturing it post-registration.
 */
public class HabeasDataRequeridoException extends RuntimeException {

    public HabeasDataRequeridoException() {
        super("Habeas Data consent is required");
    }
}
