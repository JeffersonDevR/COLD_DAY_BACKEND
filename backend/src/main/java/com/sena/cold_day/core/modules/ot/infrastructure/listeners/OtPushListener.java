package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Push de las transiciones de la OT que el usuario espera oir: presupuesto
 * enviado, orden aceptada y presupuesto aprobado.
 *
 * <p>{@code AFTER_COMMIT}: el aviso nunca sale antes de persistir, para no
 * anunciar un estado que un rollback borra (misma razon que los listeners SSE).
 * Un fallo se traga y se loguea sin datos del usuario: el estado de la OT es la
 * fuente de verdad y el push nunca rompe el flujo.
 */
@Component
public class OtPushListener {

    private static final Logger log = LoggerFactory.getLogger(OtPushListener.class);

    private final OtRepository otRepository;
    private final NotificacionPushPort push;

    public OtPushListener(OtRepository otRepository, NotificacionPushPort push) {
        this.otRepository = otRepository;
        this.push = push;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCambiarEstado(OtEstadoCambiado evento) {
        try {
            if (evento.origen() == EstadoOt.EN_CAMINO && evento.destino() == EstadoOt.EN_DIAGNOSTICO) {
                cargar(evento).ifPresent(ot -> push.notificarPresupuestoEnviado(ot.getClienteId(), ot));
            } else if (evento.origen() == EstadoOt.EN_DIAGNOSTICO && evento.destino() == EstadoOt.EN_REPARACION) {
                cargar(evento).filter(ot -> ot.getTecnicoId() != null)
                        .ifPresent(ot -> push.notificarPresupuestoAprobado(ot.getTecnicoId(), ot));
            }
        } catch (RuntimeException e) {
            log.warn("Fallo el push de cambio de estado: {}", e.getClass().getSimpleName());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alAsignar(OtAsignada evento) {
        try {
            otRepository.buscarPorId(evento.otId())
                    .ifPresent(ot -> push.notificarOtAceptada(evento.clienteId(), ot));
        } catch (RuntimeException e) {
            log.warn("Fallo el push de OT aceptada: {}", e.getClass().getSimpleName());
        }
    }

    private Optional<Ot> cargar(OtEstadoCambiado evento) {
        return otRepository.buscarPorId(evento.otId());
    }
}
