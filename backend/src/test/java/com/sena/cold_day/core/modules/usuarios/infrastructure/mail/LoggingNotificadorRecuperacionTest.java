package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

/**
 * R3/M10: the fallback must record the request (never silently drop it) but MUST
 * NOT leak the raw reset token into production logs. The raw token is only
 * allowed when explicitly enabled for non-production environments.
 */
class LoggingNotificadorRecuperacionTest {

    private static final String TOKEN_PLANO = "TOKEN-SECRETO-123";
    private final RecuperacionSolicitada evento = new RecuperacionSolicitada(42L, "ana@example.com", TOKEN_PLANO);

    private Logger logger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attach() {
        logger = (Logger) LoggerFactory.getLogger(LoggingNotificadorRecuperacion.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(appender);
    }

    @Test
    void recordsTheRequestButNeverTheRawTokenWithProductionDefaults() {
        new LoggingNotificadorRecuperacion(props(false)).notificar(evento);

        String traza = traza();
        assertThat(traza).contains("ana@example.com").contains("42");
        assertThat(traza).doesNotContain(TOKEN_PLANO);
    }

    @Test
    void exposesTheRawTokenOnlyWhenExplicitlyEnabledForNonProduction() {
        new LoggingNotificadorRecuperacion(props(true)).notificar(evento);

        assertThat(traza()).contains(TOKEN_PLANO);
    }

    @Test
    void theNonProductionLineCarriesTheResetLinkSoTheTokenIsActionable() {
        new LoggingNotificadorRecuperacion(props(true)).notificar(evento);

        assertThat(traza()).contains("token=" + TOKEN_PLANO);
    }

    private String traza() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage)
                .reduce("", (a, b) -> a + "\n" + b);
    }

    private static MailProperties props(boolean logToken) {
        return new MailProperties(false, "", 0, "", "", "", true, "http://localhost:4200/recuperar", logToken);
    }
}
