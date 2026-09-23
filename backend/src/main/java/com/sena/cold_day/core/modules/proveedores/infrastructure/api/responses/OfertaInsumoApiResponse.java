package com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;

/**
 * API view of a supplier's insumo offer. When the caller holds the request it is
 * embedded (the supplier listing), so the portal can render the declared lines
 * and offer window without a second round trip; the reject response carries the
 * offer alone.
 */
public record OfertaInsumoApiResponse(
        String id,
        String requerimientoId,
        String proveedorId,
        OfertaInsumoEstado estado,
        Instant creadaEn,
        Instant expiraEn,
        Instant resueltaEn,
        SolicitudInsumoApiResponse requerimiento) {

    public static OfertaInsumoApiResponse from(OfertaInsumo oferta, RequerimientoInsumo requerimiento) {
        return new OfertaInsumoApiResponse(
                oferta.getId() == null ? null : oferta.getId().valor().toString(),
                oferta.getRequerimientoId() == null ? null : oferta.getRequerimientoId().valor().toString(),
                oferta.getProveedorId() == null ? null : oferta.getProveedorId().valor().toString(),
                oferta.getEstado(), oferta.getCreadaEn(), oferta.getExpiraEn(), oferta.getResueltaEn(),
                requerimiento == null ? null : SolicitudInsumoApiResponse.from(requerimiento));
    }
}
