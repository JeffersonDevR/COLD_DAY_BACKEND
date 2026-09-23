package com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses;

import java.time.Instant;
import java.util.List;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.RequerimientoInsumoItem;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;

/**
 * API view of an insumo request root. Identifiers are plain UUID strings and the
 * lines are the free-text insumo declarations raised at diagnóstico time (design
 * AD5: they live in the despacho tables, never in the OT diagnóstico JSON
 * column).
 */
public record SolicitudInsumoApiResponse(
        String id,
        String otId,
        String tecnicoId,
        EstadoRequerimiento estado,
        String observaciones,
        List<LineaInsumoApiResponse> items,
        Instant creadaEn,
        Instant expiraEn,
        Instant resueltaEn) {

    public static SolicitudInsumoApiResponse from(RequerimientoInsumo requerimiento) {
        return new SolicitudInsumoApiResponse(
                requerimiento.getId() == null ? null : requerimiento.getId().valor().toString(),
                requerimiento.getOtId() == null ? null : requerimiento.getOtId().toString(),
                requerimiento.getTecnicoId() == null ? null : requerimiento.getTecnicoId().toString(),
                requerimiento.getEstado(), requerimiento.getObservaciones(),
                requerimiento.getItems().stream().map(LineaInsumoApiResponse::from).toList(),
                requerimiento.getCreadaEn(), requerimiento.getExpiraEn(), requerimiento.getResueltaEn());
    }

    /** One declared insumo line: free-text description plus a positive quantity. */
    public record LineaInsumoApiResponse(String descripcion, int cantidad) {

        public static LineaInsumoApiResponse from(RequerimientoInsumoItem item) {
            return new LineaInsumoApiResponse(item.getDescripcion(), item.getCantidad());
        }
    }
}
