package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

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

    /**
     * Same wire shape for a transition that is known without a generic
     * {@link OtEstadoCambiado} event. The assignment is published as
     * {@code OtAsignada} and never passes the repository drain loop, so its
     * origin and destination have to be supplied explicitly.
     */
    public static OtEstadoCambiadoSseApiResponse de(OtId otId, EstadoOt origen, EstadoOt destino) {
        return new OtEstadoCambiadoSseApiResponse(otId.valor().toString(), origen, destino);
    }
}
