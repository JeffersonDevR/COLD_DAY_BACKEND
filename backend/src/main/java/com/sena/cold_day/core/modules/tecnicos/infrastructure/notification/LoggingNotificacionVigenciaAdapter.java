package com.sena.cold_day.core.modules.tecnicos.infrastructure.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.tecnicos.domain.events.DocumentoPorVencer;
import com.sena.cold_day.core.modules.tecnicos.domain.services.NotificacionVigenciaPort;

/**
 * Logging delivery of pre-expiry notices (C3). Real transport (email/push) is
 * out of scope for this slice; the port boundary keeps it replaceable.
 */
@Component
public class LoggingNotificacionVigenciaAdapter implements NotificacionVigenciaPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotificacionVigenciaAdapter.class);

    @Override
    public void notificarProximoVencimiento(DocumentoPorVencer aviso) {
        log.info("Documento por vencer: tecnico={} documento={} fechaVencimiento={} diasRestantes={} audiencias={}",
                aviso.tecnicoId(), aviso.documento(), aviso.fechaVencimiento(), aviso.diasRestantes(),
                aviso.audiencias());
    }
}
