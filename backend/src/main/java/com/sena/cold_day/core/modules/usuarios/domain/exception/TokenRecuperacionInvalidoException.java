package com.sena.cold_day.core.modules.usuarios.domain.exception;

/**
 * Thrown when a password reset is attempted with a token that is unknown,
 * expired, already consumed, or bound to a missing usuario. Callers respond
 * with a generic 400 so invalid tokens are not differentiated.
 */
public class TokenRecuperacionInvalidoException extends RuntimeException {

    public TokenRecuperacionInvalidoException() {
        super("Token de recuperacion invalido");
    }
}
