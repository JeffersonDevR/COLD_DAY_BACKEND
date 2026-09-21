package com.sena.cold_day.core.modules.administracion.application.dto;

import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** Vista de aplicacion de una disputa en mediacion (RF-F1-25). */
public record DisputaResponse(
        DisputaId id,
        OtId otId,
        String motivo,
        EstadoDisputa estado,
        String resolucion,
        Instant creadaEn,
        Instant resueltaEn,
        String clienteNombre,
        String tecnicoNombre) {

    public static DisputaResponse fromDomain(Disputa disputa) {
        return new DisputaResponse(disputa.getId(), disputa.getOtId(), disputa.getMotivo(),
                disputa.getEstado(), disputa.getResolucion(), disputa.getCreadaEn(),
                disputa.getResueltaEn(), null, null);
    }

    public DisputaResponse conNombres(String cliente, String tecnico) {
        return new DisputaResponse(id, otId, motivo, estado, resolucion, creadaEn, resueltaEn,
                cliente, tecnico);
    }
}
