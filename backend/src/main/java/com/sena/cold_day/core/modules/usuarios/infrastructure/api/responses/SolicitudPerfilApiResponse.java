package com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilResponse;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** Contrato REST de una solicitud de cambio de perfil. */
public record SolicitudPerfilApiResponse(
        Long id,
        Long usuarioId,
        Rol perfilDeseado,
        EstadoSolicitudPerfil estado,
        String motivacion,
        Instant creadaEn,
        Instant resueltaEn,
        String motivoRechazo) {

    public static SolicitudPerfilApiResponse from(SolicitudPerfilResponse response) {
        return new SolicitudPerfilApiResponse(
                response.id(), response.usuarioId(), response.perfilDeseado(), response.estado(),
                response.motivacion(), response.creadaEn(), response.resueltaEn(), response.motivoRechazo());
    }
}
