package com.sena.cold_day.core.modules.usuarios.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;

/**
 * R1: the production listener must deliver the event through the port. The
 * AFTER_COMMIT/fallbackExecution contract mirrors
 * {@code OtEstadoCambiadoSseListener} and is what makes delivery happen only
 * once the token is durably persisted.
 */
class SolicitudRecuperacionListenerTest {

    private final RecuperacionSolicitada evento =
            new RecuperacionSolicitada(9L, "ana@example.com", "TOK-LISTENER");

    @Test
    void deliversThroughTheNotifierPort() {
        NotificadorRecuperacion notificador = mock(NotificadorRecuperacion.class);

        new SolicitudRecuperacionListener(notificador).alSolicitar(evento);

        verify(notificador).notificar(evento);
    }

    @Test
    void runsAfterCommitWithFallbackExecution() throws Exception {
        Method metodo = SolicitudRecuperacionListener.class.getMethod("alSolicitar", RecuperacionSolicitada.class);

        TransactionalEventListener anotacion = metodo.getAnnotation(TransactionalEventListener.class);

        assertThat(anotacion).isNotNull();
        assertThat(anotacion.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
        assertThat(anotacion.fallbackExecution()).isTrue();
    }
}
