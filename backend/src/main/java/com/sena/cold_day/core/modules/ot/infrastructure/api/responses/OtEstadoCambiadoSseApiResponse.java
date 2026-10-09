package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Wire shape of the {@code ot-estado-cambiado} SSE event.
 *
 * <p>{@code otId} is a plain string on purpose: serialising the domain
 * {@link com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId} record
 * directly would nest it as {@code {"valor":"..."}} and force every client to
 * reach one level in for the identifier. The same scalar-id convention is used
 * by {@link OtApiResponse}.
 */
public record OtEstadoCambiadoSseApiResponse(String otId, EstadoOt origen, EstadoOt destino) {

    public static OtEstadoCambiadoSseApiResponse de(OtEstadoCambiado evento) {
        return new OtEstadoCambiadoSseApiResponse(evento.otId().valor().toString(),
                evento.origen(), evento.destino());
    }
}
