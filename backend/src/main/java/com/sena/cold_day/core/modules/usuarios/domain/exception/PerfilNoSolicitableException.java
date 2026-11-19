package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** El perfil deseado no es conmutable o coincide con el rol inicial del usuario. */
public class PerfilNoSolicitableException extends RuntimeException {

    public PerfilNoSolicitableException() {
        super("El perfil solicitado debe ser CLIENTE o TECNICO y distinto de tu perfil actual.");
    }
}
