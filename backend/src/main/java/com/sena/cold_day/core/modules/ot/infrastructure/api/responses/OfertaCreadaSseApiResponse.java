package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import com.sena.cold_day.core.modules.ot.domain.events.OfertaCreada;

/**
 * Wire shape of the {@code oferta-creada} SSE event.
 *
 * <p>Deliberately smaller than {@link OtEstadoCambiadoSseApiResponse}: this
 * channel carries no state transition, so reusing that record would mean
 * inventing an {@code origen}/{@code destino} pair that never happened. The
 * event is a signal, not a state snapshot — the client reacts by refetching its
 * own offers, and {@code otId} is informational (it is an OT the recipient was
 * already offered, so it leaks nothing new).
 *
 * <p>{@code otId} is a plain string on purpose, matching the scalar-id
 * convention of {@link OtApiResponse}.
 */
public record OfertaCreadaSseApiResponse(String otId) {

    public static OfertaCreadaSseApiResponse de(OfertaCreada evento) {
        return new OfertaCreadaSseApiResponse(evento.otId().valor().toString());
    }
}
