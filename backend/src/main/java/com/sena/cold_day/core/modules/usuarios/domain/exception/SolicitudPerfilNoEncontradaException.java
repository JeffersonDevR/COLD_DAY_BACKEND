package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** No existe la solicitud que se intenta resolver. */
public class SolicitudPerfilNoEncontradaException extends RuntimeException {

    public SolicitudPerfilNoEncontradaException(Long id) {
        super("No existe la solicitud de perfil " + id + ".");
    }
}
