package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.application.dto.DisputaResponse;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;

/**
 * API view of a dispute: identifiers as plain UUIDs. {@code otCodigo} accompanies
 * {@code otId} so the UI can name the OT without showing its UUID.
 */
public record DisputaApiResponse(
        String id,
        String otId,
        String otCodigo,
        String motivo,
        EstadoDisputa estado,
        String resolucion,
        Instant creadaEn,
        Instant resueltaEn,
        String clienteNombre,
        String tecnicoNombre) {

    public static DisputaApiResponse from(DisputaResponse response) {
        return new DisputaApiResponse(
                response.id() == null ? null : response.id().valor().toString(),
                response.otId() == null ? null : response.otId().valor().toString(),
                response.otCodigo(),
                response.motivo(), response.estado(), response.resolucion(),
                response.creadaEn(), response.resueltaEn(),
                response.clienteNombre(), response.tecnicoNombre());
    }
}
