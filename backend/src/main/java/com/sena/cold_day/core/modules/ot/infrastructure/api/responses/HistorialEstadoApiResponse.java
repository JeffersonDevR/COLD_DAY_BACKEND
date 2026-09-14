package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/** API view of one append-only history entry (RNF-09). */
public record HistorialEstadoApiResponse(
        EstadoOt estadoOrigen,
        EstadoOt estadoDestino,
        ActorOt actor,
        Instant ocurridoEn,
        String motivo) {

    public static HistorialEstadoApiResponse from(OtEstadoHistorial entrada) {
        CambioEstado cambio = entrada.getCambio();
        return new HistorialEstadoApiResponse(cambio.origen(), cambio.destino(), cambio.actor(),
                cambio.ocurridoEn(), cambio.motivo());
    }
}
