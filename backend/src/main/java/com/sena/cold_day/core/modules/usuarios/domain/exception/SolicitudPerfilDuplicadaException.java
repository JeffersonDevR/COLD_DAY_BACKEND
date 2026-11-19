package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** Ya existe una solicitud PENDIENTE del usuario para ese perfil. */
public class SolicitudPerfilDuplicadaException extends RuntimeException {

    public SolicitudPerfilDuplicadaException() {
        super("Ya tienes una solicitud pendiente para ese perfil.");
    }
}
