package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

import java.time.Instant;

/**
 * Auth token VO. The aggregate never signs it; issuing lives behind the
 * TokenIssuer port in infrastructure (JWT signing/parsing there).
 */
public record Token(String valor, Instant expiracion) {

    public Token {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("token valor requerido");
        }
        if (expiracion == null) {
            throw new IllegalArgumentException("token expiracion requerida");
        }
    }

    public static Token de(String valor, Instant expiracion) {
        return new Token(valor, expiracion);
    }

    public boolean haExpirado() {
        return Instant.now().isAfter(expiracion);
    }
}
