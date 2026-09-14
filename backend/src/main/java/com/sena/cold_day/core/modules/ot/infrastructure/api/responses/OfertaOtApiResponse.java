package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;

/** API view of a dispatch offer: identifiers are plain UUID strings (design D4). */
public record OfertaOtApiResponse(
        String id,
        String otId,
        String tecnicoId,
        double radioKm,
        OfertaEstado estado,
        Instant creadaEn,
        Instant expiraEn) {

    public static OfertaOtApiResponse from(OfertaOt oferta) {
        return new OfertaOtApiResponse(
                oferta.getId() == null ? null : oferta.getId().valor().toString(),
                oferta.getOtId() == null ? null : oferta.getOtId().valor().toString(),
                oferta.getTecnicoId() == null ? null : oferta.getTecnicoId().valor().toString(),
                oferta.getRadioKm(), oferta.getEstado(), oferta.getCreadaEn(), oferta.getExpiraEn());
    }
}
