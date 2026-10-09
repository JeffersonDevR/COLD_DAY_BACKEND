package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.application.dto.OfertaTecnicoResumen;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;

/**
 * API view of a dispatch offer: identifiers are plain UUID strings (design D4).
 *
 * <p>The {@code ot} field is an additive, reduced summary of the offered order
 * (see {@link OfertaOtResumenApiResponse} for why it is reduced). It is
 * {@code null} when the order could not be resolved, in which case the client
 * must skip that offer. Every previously existing field keeps its name and
 * meaning, so existing consumers are unaffected.
 */
public record OfertaOtApiResponse(
        String id,
        String otId,
        String tecnicoId,
        double radioKm,
        OfertaEstado estado,
        Instant creadaEn,
        Instant expiraEn,
        OfertaOtResumenApiResponse ot) {

    /** Backwards-compatible view without the nested order. */
    public static OfertaOtApiResponse from(OfertaOt oferta) {
        return from(oferta, null);
    }

    public static OfertaOtApiResponse from(OfertaOt oferta, OfertaOtResumenApiResponse ot) {
        return new OfertaOtApiResponse(
                oferta.getId() == null ? null : oferta.getId().valor().toString(),
                oferta.getOtId() == null ? null : oferta.getOtId().valor().toString(),
                oferta.getTecnicoId() == null ? null : oferta.getTecnicoId().valor().toString(),
                oferta.getRadioKm(), oferta.getEstado(), oferta.getCreadaEn(), oferta.getExpiraEn(), ot);
    }

    /** Maps the application view (offer + order + client name) to the wire view. */
    public static OfertaOtApiResponse from(OfertaTecnicoResumen resumen) {
        return from(resumen.oferta(),
                OfertaOtResumenApiResponse.de(resumen.ot(), resumen.clienteNombre()));
    }
}
