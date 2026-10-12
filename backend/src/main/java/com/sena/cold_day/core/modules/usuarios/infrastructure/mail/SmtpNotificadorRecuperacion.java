package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

/**
 * SMTP delivery of password-recovery tokens (WS8/R1). Active only when
 * {@code app.mail.enabled=true}; otherwise {@link LoggingNotificadorRecuperacion}
 * takes over. TLS is enforced by {@code MailConfig} (M10).
 *
 * <p>The delivery runs from an {@code AFTER_COMMIT} listener, so a transport
 * failure is swallowed (and logged) instead of surfacing to the caller whose
 * request already succeeded: the persisted token hash remains the source of
 * truth and the user can request a new link.
 */
@Component
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "true")
public class SmtpNotificadorRecuperacion implements NotificadorRecuperacion {

    private static final Logger log = LoggerFactory.getLogger(SmtpNotificadorRecuperacion.class);

    private final JavaMailSender sender;
    private final MailProperties propiedades;

    public SmtpNotificadorRecuperacion(JavaMailSender sender, MailProperties propiedades) {
        this.sender = sender;
        this.propiedades = propiedades;
    }

    @Override
    public void notificar(RecuperacionSolicitada evento) {
        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();
            mensaje.setFrom(propiedades.from());
            mensaje.setTo(evento.correo());
            mensaje.setSubject("Restablece tu contrasena - COLD DAY");
            mensaje.setText(cuerpo(evento));
            sender.send(mensaje);
        } catch (MailException ex) {
            log.error("No se pudo entregar el correo de recuperacion: usuarioId={}", evento.usuarioId(), ex);
        }
    }

    private String cuerpo(RecuperacionSolicitada evento) {
        return """
                Hola,

                Recibimos una solicitud para restablecer tu contrasena de COLD DAY.
                Abre este enlace (vigente por 30 minutos):

                %s

                Si no solicitaste el cambio, ignora este mensaje.
                """.formatted(propiedades.enlaceDeRecuperacion(evento.token()));
    }
}
