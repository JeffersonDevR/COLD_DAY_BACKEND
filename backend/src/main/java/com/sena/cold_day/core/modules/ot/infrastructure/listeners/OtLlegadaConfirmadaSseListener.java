package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.events.OtLlegadaConfirmada;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges {@link OtLlegadaConfirmada} to the SSE registry.
 *
 * <p>Why this listener exists: the arrival is a fact and not a transition, so
 * it never produces a {@code CambioEstado} and the repository drain loop - the
 * only publisher of the generic state-change event - stays silent. Without
 * this listener the client watching the order would never learn that the
 * technician had arrived.
 *
 * <p>It publishes under the same key, event name and payload shape the client
 * already consumes, so the frontend needs no change: the subscriber reloads
 * the order and finds the arrival instant in the OT response.
 *
 * <p>{@code AFTER_COMMIT} for the same reason as the other listeners: pushing
 * the arrival while the transaction is still open would announce an arrival
 * that a later rollback erases. {@code fallbackExecution = true} keeps the
 * event flowing if a path ever publishes outside a transaction.
 */
@Component
public class OtLlegadaConfirmadaSseListener {

    private final SseEmitterRegistry registry;

    public OtLlegadaConfirmadaSseListener(SseEmitterRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alConfirmarLlegada(OtLlegadaConfirmada evento) {
        registry.publicar(OtEstadoCambiadoSseListener.clave(evento.otId()),
                OtEstadoCambiadoSseListener.EVENTO,
                OtEstadoCambiadoSseApiResponse.deLlegada(evento.otId(), evento.estado(), evento.llegadaEn()));
    }
}
