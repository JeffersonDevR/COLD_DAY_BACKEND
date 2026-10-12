package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

/**
 * R1: when SMTP is configured the token is delivered by email. A transport
 * failure must never surface after the transaction already committed.
 */
class SmtpNotificadorRecuperacionTest {

    private static final RecuperacionSolicitada EVENTO =
            new RecuperacionSolicitada(7L, "ana@example.com", "TOK-UNICO-1");

    @Test
    void sendsAnEmailWithTheResetLinkToTheAccount() {
        JavaMailSender sender = mock(JavaMailSender.class);

        new SmtpNotificadorRecuperacion(sender, props()).notificar(EVENTO);

        ArgumentCaptor<SimpleMailMessage> capturado = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(capturado.capture());
        SimpleMailMessage mensaje = capturado.getValue();
        assertThat(mensaje.getFrom()).isEqualTo("no-reply@coldday.co");
        assertThat(mensaje.getTo()).containsExactly("ana@example.com");
        assertThat(mensaje.getText()).contains("TOK-UNICO-1")
                .contains("https://app.coldday.co/recuperar?token=TOK-UNICO-1");
    }

    @Test
    void aTransportFailureIsSwallowedBecauseDispatchRunsAfterCommit() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("smtp caido")).when(sender).send(any(SimpleMailMessage.class));

        assertThatCode(() -> new SmtpNotificadorRecuperacion(sender, props()).notificar(EVENTO))
                .doesNotThrowAnyException();
    }

    private static MailProperties props() {
        return new MailProperties(true, "smtp.example.com", 587, "usuario", "secreto", "no-reply@coldday.co",
                true, "https://app.coldday.co/recuperar", false);
    }
}
