package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Logging delivery of dispatch notifications (task 6a.3). FCM transport is
 * deferred (D6): the offer state is authoritative and dispatch must never block
 * on push delivery, so this adapter only records the event.
 */
@Component
public class LoggingNotificacionPushAdapter implements NotificacionPushPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotificacionPushAdapter.class);

    @Override
    public void notificarOferta(TecnicoId tecnicoId, OfertaOt oferta, Ot ot) {
        log.info("Oferta de OT despachada: ot={} tecnico={} oferta={} radioKm={} expiraEn={}",
                ot.getId(), tecnicoId, oferta.getId(), oferta.getRadioKm(), oferta.getExpiraEn());
    }

    @Override
    public void notificarCliente(ClienteId clienteId, Ot ot, String mensaje) {
        log.info("Notificacion al cliente: cliente={} ot={} mensaje={}", clienteId, ot.getId(), mensaje);
    }
}
