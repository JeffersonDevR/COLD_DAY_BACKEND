package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.events.OfertaCreada;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OfertaCreadaSseApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges {@link OfertaCreada} to the SSE registry, under the technician key.
 *
 * <p>Why this listener exists: dispatch creates the offers and publishes nothing
 * to the stream, so a technician who is not sitting on the offers page never
 * learns a 60-second offer was created. The offer rows are pollable, but the
 * poll only runs while that page is open — the notification is what covers the
 * rest of the app.
 *
 * <p>Keyed by technician, not by OT, because the recipient is the only thing the
 * client knows: see {@link #claveTecnico(TecnicoId)}.
 *
 * <p>{@code AFTER_COMMIT} for the same reason as the other bridges: announcing
 * an offer while its transaction is still open would push a window that a later
 * rollback erases. {@code fallbackExecution = true} keeps the event flowing if a
 * path ever publishes outside a transaction.
 */
@Component
public class OfertaCreadaSseListener {

    /** SSE event name consumed by the client. */
    public static final String EVENTO = "oferta-creada";

    /**
     * Namespace prefix. An OT stream key is a bare OT id, so prefixing the
     * technician namespace makes the two families unable to collide.
     */
    static final String PREFIJO_TECNICO = "tecnico:";

    private final SseEmitterRegistry registry;

    public OfertaCreadaSseListener(SseEmitterRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCrearOferta(OfertaCreada evento) {
        // One event per recipient, published under the technician key so the
        // recipient is the only thing the client needs; the listener still fires
        // only after commit.
        registry.publicar(claveTecnico(evento.tecnicoId()), EVENTO, OfertaCreadaSseApiResponse.de(evento));
    }

    /**
     * Stream key for a technician. The stream controller registers under the same
     * key, so the derivation lives in one place — same rule as
     * {@link OtEstadoCambiadoSseListener#clave(com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId)}.
     */
    public static String claveTecnico(TecnicoId tecnicoId) {
        return PREFIJO_TECNICO + tecnicoId.valor();
    }
}
