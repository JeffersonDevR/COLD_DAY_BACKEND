package com.sena.cold_day.core.modules.usuarios.application.dto;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** Representacion de una solicitud para el solicitante y para la bandeja admin. */
public record SolicitudPerfilResponse(
        Long id,
        Long usuarioId,
        Rol perfilDeseado,
        EstadoSolicitudPerfil estado,
        String motivacion,
        Instant creadaEn,
        Instant resueltaEn,
        String motivoRechazo) {

    public static SolicitudPerfilResponse from(SolicitudPerfil solicitud) {
        return new SolicitudPerfilResponse(
                solicitud.getId(), solicitud.getUsuarioId(), solicitud.getPerfilDeseado(),
                solicitud.getEstado(), solicitud.getMotivacion(), solicitud.getCreadaEn(),
                solicitud.getResueltaEn(), solicitud.getMotivoRechazo());
    }
}
