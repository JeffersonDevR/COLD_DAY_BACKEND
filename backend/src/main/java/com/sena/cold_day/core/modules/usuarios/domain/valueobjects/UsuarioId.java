package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

/** Identifier of the Usuario aggregate. Roles reference Usuario by this VO, never by class inheritance. */
public record UsuarioId(Long valor) {

    public UsuarioId {
        if (valor == null) {
            throw new IllegalArgumentException("UsuarioId no puede ser null");
        }
    }
}
