package com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.proveedores.application.usecases.ListarIncumplimientosUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;

/** One recorded ETA breach, for the administrator. */
public record IncumplimientoApiResponse(String id, String proveedorId, String razonSocial, String requerimientoId,
        int etaMinutos, Instant aceptadaEn, Instant reemplazadoEn) {

    public static IncumplimientoApiResponse from(ListarIncumplimientosUseCase.Item item) {
        IncumplimientoInsumo origen = item.incumplimiento();
        return new IncumplimientoApiResponse(origen.id().toString(), origen.proveedorId().valor().toString(),
                item.razonSocial(), origen.requerimientoId().valor().toString(), origen.etaMinutos(),
                origen.aceptadaEn(), origen.reemplazadoEn());
    }
}
