package com.sena.cold_day.core.modules.administracion.application.dto;

import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** Vista de aplicacion de una disputa en mediacion (RF-F1-25). */
public record DisputaResponse(
        DisputaId id,
        OtId otId,
        String otCodigo,
        String motivo,
        EstadoDisputa estado,
        String resolucion,
        Instant creadaEn,
        Instant resueltaEn,
        String clienteNombre,
        String tecnicoNombre) {

    public static DisputaResponse fromDomain(Disputa disputa) {
        return new DisputaResponse(disputa.getId(), disputa.getOtId(), null, disputa.getMotivo(),
                disputa.getEstado(), disputa.getResolucion(), disputa.getCreadaEn(),
                disputa.getResueltaEn(), null, null);
    }

    public DisputaResponse conNombres(String cliente, String tecnico) {
        return new DisputaResponse(id, otId, otCodigo, motivo, estado, resolucion, creadaEn, resueltaEn,
                cliente, tecnico);
    }

    /**
     * Attaches the human-readable code of the disputed order, so the admin page
     * can name the OT instead of printing its UUID. The caller already loaded the
     * order, so this is a read of state it holds, not an extra lookup.
     */
    public DisputaResponse conOtCodigo(CodigoOt codigo) {
        return new DisputaResponse(id, otId, codigo == null ? null : codigo.valor(), motivo, estado,
                resolucion, creadaEn, resueltaEn, clienteNombre, tecnicoNombre);
    }
}
