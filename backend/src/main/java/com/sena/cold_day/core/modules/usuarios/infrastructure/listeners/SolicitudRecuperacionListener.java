package com.sena.cold_day.core.modules.usuarios.infrastructure.listeners;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;

/**
 * Production bridge from {@link RecuperacionSolicitada} to the delivery port
 * (WS8). Without it the reset token was generated and persisted but never
 * delivered.
 *
 * <p>{@code phase = AFTER_COMMIT} is load-bearing: delivery must happen only
 * once the token row is committed, so a later rollback can never send a link
 * that does not exist. {@code fallbackExecution = true} keeps the event flowing
 * if a path ever publishes outside a transaction (no commit event to hang off),
 * matching {@code OtEstadoCambiadoSseListener}.
 */
@Component
public class SolicitudRecuperacionListener {

    private final NotificadorRecuperacion notificador;

    public SolicitudRecuperacionListener(NotificadorRecuperacion notificador) {
        this.notificador = notificador;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alSolicitar(RecuperacionSolicitada evento) {
        notificador.notificar(evento);
    }
}
