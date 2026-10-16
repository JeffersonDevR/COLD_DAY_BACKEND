package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges {@link OtAsignada} to the SSE registry.
 *
 * <p>Why this listener exists: the winning acceptance assigns the order through
 * the bulk conditional UPDATE {@code intentarAsignar} and appends its history
 * entry by hand, so it never calls {@code OtRepository.save}. The drain loop is
 * the only publisher of {@link com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado},
 * which means the {@code BUSCANDO_TECNICO -> ASIGNADA} transition — the one the
 * client is waiting for — never reaches {@link OtEstadoCambiadoSseListener}.
 * A domain event without a listener covers nothing; this is that listener.
 *
 * <p>It publishes under the same key, event name and payload shape the client
 * already consumes, so the frontend needs no change.
 *
 * <p>{@code AFTER_COMMIT} for the same reason as the generic listener: pushing
 * the new state while the transaction is still open would announce an
 * assignment that a later rollback erases. {@code fallbackExecution = true}
 * keeps the event flowing if a path ever publishes outside a transaction.
 */
@Component
public class OtAsignadaSseListener {

    private final SseEmitterRegistry registry;

    public OtAsignadaSseListener(SseEmitterRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alAsignar(OtAsignada evento) {
        // The transition is reported as the real one, BUSCANDO_TECNICO ->
        // ASIGNADA: the payload stays truthful instead of inventing a null
        // origin the client would have to special-case.
        registry.publicar(OtEstadoCambiadoSseListener.clave(evento.otId()),
                OtEstadoCambiadoSseListener.EVENTO,
                OtEstadoCambiadoSseApiResponse.de(evento.otId(), EstadoOt.BUSCANDO_TECNICO,
                        EstadoOt.ASIGNADA));
    }
}
