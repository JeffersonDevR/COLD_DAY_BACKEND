package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** La solicitud ya fue aprobada o rechazada; no se puede resolver dos veces. */
public class SolicitudPerfilYaResueltaException extends RuntimeException {

    public SolicitudPerfilYaResueltaException(Long id) {
        super("La solicitud de perfil " + id + " ya fue resuelta.");
    }
}
