package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

/**
 * Logging delivery used when the SMTP transport is disabled (default dev/test,
 * and the {@code app.mail.enabled=false} kill switch in production). Mirrors the
 * existing {@code LoggingNotificacion*Adapter} pattern.
 *
 * <p>Security (R3/M10): the raw reset token is only written when
 * {@code app.mail.log-token=true}, which is set for local/demo runs only. In
 * production the default {@code false} keeps the token out of the logs while the
 * request itself is still recorded, so nothing is silently dropped.
 */
@Component
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "false", matchIfMissing = true)
@ConditionalOnMissingBean(NotificadorRecuperacion.class)
public class LoggingNotificadorRecuperacion implements NotificadorRecuperacion {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotificadorRecuperacion.class);

    private final MailProperties propiedades;

    public LoggingNotificadorRecuperacion(MailProperties propiedades) {
        this.propiedades = propiedades;
    }

    @Override
    public void notificar(RecuperacionSolicitada evento) {
        if (propiedades.logToken() && log.isInfoEnabled()) {
            log.info("Recuperacion solicitada (modo local): usuarioId={} correo={} token={} enlace={}",
                    evento.usuarioId(), evento.correo(), evento.token(),
                    propiedades.enlaceDeRecuperacion(evento.token()));
            return;
        }
        log.info("Recuperacion solicitada: usuarioId={} correo={} (token no registrado; configura SMTP para entregarlo)",
                evento.usuarioId(), evento.correo());
    }
}
