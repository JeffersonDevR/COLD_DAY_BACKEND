package com.sena.cold_day.core.modules.usuarios.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Fail-fast contract (M10): a disabled mail transport may ship with no
 * credentials, but enabling it without host/from/credentials must abort startup
 * instead of silently dropping every recovery token.
 */
class MailPropertiesTest {

    private static MailProperties props(boolean enabled, String host, String username, String password,
            String from) {
        return new MailProperties(enabled, host, 0, username, password, from, true, "", false);
    }

    @Test
    void disabledWithoutCredentialsIsValidAndUsesSafeDefaults() {
        MailProperties p = props(false, "", "", "", "");

        assertThat(p.enabled()).isFalse();
        assertThat(p.port()).isEqualTo(MailProperties.PUERTO_POR_DEFECTO);
        assertThat(p.tls()).isTrue();
    }

    @Test
    void enabledWithHostAndCredentialsIsValid() {
        MailProperties p = props(true, "smtp.example.com", "usuario", "secreto", "no-reply@coldday.co");

        assertThat(p.enabled()).isTrue();
        assertThat(p.host()).isEqualTo("smtp.example.com");
        assertThat(p.username()).isEqualTo("usuario");
        assertThat(p.from()).isEqualTo("no-reply@coldday.co");
    }

    @Test
    void enabledWithoutHostFailsFast() {
        assertThatThrownBy(() -> props(true, "  ", "usuario", "secreto", "no-reply@coldday.co"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.mail.host");
    }

    @Test
    void enabledWithoutFromFailsFast() {
        assertThatThrownBy(() -> props(true, "smtp.example.com", "usuario", "secreto", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.mail.from");
    }

    @Test
    void enabledWithoutCredentialsFailsFast() {
        assertThatThrownBy(() -> props(true, "smtp.example.com", "", "", "no-reply@coldday.co"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.mail.username");
    }

    @Test
    void blankOptionalValuesAreNormalizedWhenDisabled() {
        assertThatCode(() -> props(false, null, null, null, null)).doesNotThrowAnyException();
    }
}
