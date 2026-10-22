package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
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
 *
 * <p>{@code llegadaEn} rides along for the events that are not a state change
 * (the arrival confirmation, which is a fact). It is omitted when absent, so
 * the payload of a plain transition stays exactly what it always was.
 *
 * <p>{@code visitaPagadaEn} does the same for the visit payment: the order
 * does not change state when the client pays, so the instant of the payment is
 * what makes the event meaningful. It is omitted when absent, so the payload
 * of a plain transition stays exactly what it always was.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OtEstadoCambiadoSseApiResponse(String otId, EstadoOt origen, EstadoOt destino, Instant llegadaEn,
        Instant visitaPagadaEn) {

    /** Payload of a plain transition: no arrival to report. */
    public OtEstadoCambiadoSseApiResponse(String otId, EstadoOt origen, EstadoOt destino) {
        this(otId, origen, destino, null, null);
    }

    /** Payload of an arrival: the state did not change, the instant did. */
    public OtEstadoCambiadoSseApiResponse(String otId, EstadoOt origen, EstadoOt destino, Instant llegadaEn) {
        this(otId, origen, destino, llegadaEn, null);
    }

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

    /**
     * Payload for the arrival confirmation.
     *
     * <p>The arrival is a fact and not a transition (SRS 5.2 has no
     * {@code EN_LLEGADO} state), so the origin and the destination are the
     * same state and the arrival instant is what makes the event meaningful.
     * A subscriber that reloads the order finds {@code llegadaEn} in the OT
     * response; one that reads the event has the instant at hand.
     */
    public static OtEstadoCambiadoSseApiResponse deLlegada(OtId otId, EstadoOt estado, Instant llegadaEn) {
        return new OtEstadoCambiadoSseApiResponse(otId.valor().toString(), estado, estado, llegadaEn);
    }

    /**
     * Payload for the visit payment.
     *
     * <p>Paying the visit is a fact and not a transition (the order keeps its
     * state), so the origin and the destination are the same state and the
     * instant of the payment is what makes the event meaningful. A subscriber
     * that reloads the order finds the visit already paid; one that reads the
     * event has the instant at hand.
     */
    public static OtEstadoCambiadoSseApiResponse deVisitaPagada(OtId otId, EstadoOt estado, Instant visitaPagadaEn) {
        return new OtEstadoCambiadoSseApiResponse(otId.valor().toString(), estado, estado, null, visitaPagadaEn);
    }
}
