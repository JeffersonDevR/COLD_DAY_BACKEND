package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges {@link OtEstadoCambiado} to the SSE registry.
 *
 * <p>{@code phase = AFTER_COMMIT} is load-bearing: publishing the state change
 * while the transaction is still open would push a state that a later rollback
 * erases, leaving the client showing an order state that never existed.
 *
 * <p>{@code fallbackExecution = true} keeps events flowing if a path ever
 * saves an OT outside a transaction (there would be no commit event to hang
 * off).
 */
@Component
public class OtEstadoCambiadoSseListener {

    /** SSE event name consumed by the client. */
    public static final String EVENTO = "ot-estado-cambiado";

    private final SseEmitterRegistry registry;

    public OtEstadoCambiadoSseListener(SseEmitterRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCambiarEstado(OtEstadoCambiado evento) {
        registry.publicar(clave(evento.otId()), EVENTO, evento);
    }

    /**
     * Stream key for an OT. The stream controller registers under the same key,
     * so the derivation lives in one place.
     */
    public static String clave(OtId otId) {
        return otId.valor().toString();
    }
}
