package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.application.dto.DisputaResponse;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;

/** Vista API de una disputa: identificadores como UUID planos. */
public record DisputaApiResponse(
        String id,
        String otId,
        String motivo,
        EstadoDisputa estado,
        String resolucion,
        Instant creadaEn,
        Instant resueltaEn) {

    public static DisputaApiResponse from(DisputaResponse response) {
        return new DisputaApiResponse(
                response.id() == null ? null : response.id().valor().toString(),
                response.otId() == null ? null : response.otId().valor().toString(),
                response.motivo(), response.estado(), response.resolucion(),
                response.creadaEn(), response.resueltaEn());
    }
}
