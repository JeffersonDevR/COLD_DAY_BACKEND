package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** Thrown when credentials do not match (login failure). */
public class CredencialesInvalidasException extends RuntimeException {

    public CredencialesInvalidasException() {
        super("Correo o password invalidos");
    }
}
