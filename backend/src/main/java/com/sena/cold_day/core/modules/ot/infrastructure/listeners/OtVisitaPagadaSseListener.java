package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.events.OtVisitaPagada;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges {@link OtVisitaPagada} to the SSE registry.
 *
 * <p>Why this listener exists: paying the visit of an assigned order does not
 * change the state of the order, so it never produces a {@code CambioEstado}
 * and the repository drain loop - the only publisher of the generic
 * state-change event - stays silent. Without this listener the technician
 * watching the order would never learn that the client paid the visit.
 *
 * <p>It publishes under the same key, event name and payload shape the client
 * already consumes, so the frontend needs no change: the subscriber reloads
 * the order and finds the visit already paid.
 *
 * <p>{@code AFTER_COMMIT} for the same reason as the other listeners: pushing
 * the payment while the transaction is still open would announce a payment
 * that a later rollback erases. {@code fallbackExecution = true} keeps the
 * event flowing if a path ever publishes outside a transaction.
 */
@Component
public class OtVisitaPagadaSseListener {

    private final SseEmitterRegistry registry;

    public OtVisitaPagadaSseListener(SseEmitterRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alPagarVisita(OtVisitaPagada evento) {
        registry.publicar(OtEstadoCambiadoSseListener.clave(evento.otId()),
                OtEstadoCambiadoSseListener.EVENTO,
                OtEstadoCambiadoSseApiResponse.deVisitaPagada(evento.otId(), evento.estado(),
                        evento.visitaPagadaEn()));
    }
}
