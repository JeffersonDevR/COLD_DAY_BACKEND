package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

/** Pure unit test for the reset-token value object. */
class TokenRecuperacionTest {

    private static final UsuarioId USUARIO = new UsuarioId(7L);
    private static final Instant CREADO = Instant.parse("2026-01-01T10:00:00Z");
    private static final Instant EXPIRA = CREADO.plus(Duration.ofMinutes(30));

    @Test
    void emittedTokenIsVigenteUntilExclusiveExpiry() {
        TokenRecuperacion token = TokenRecuperacion.emitir(USUARIO, "hash", CREADO, EXPIRA);

        assertThat(token.getUsuarioId()).isEqualTo(USUARIO);
        assertThat(token.getTokenHash()).isEqualTo("hash");
        assertThat(token.getCreadoEn()).isEqualTo(CREADO);
        assertThat(token.getExpiraEn()).isEqualTo(EXPIRA);
        assertThat(token.isUsado()).isFalse();
        assertThat(token.estaVigente(CREADO)).isTrue();
        assertThat(token.estaVigente(EXPIRA.minusSeconds(1))).isTrue();
        assertThat(token.estaVigente(EXPIRA)).isFalse();
    }

    @Test
    void usedTokenIsNeverVigente() {
        TokenRecuperacion token = TokenRecuperacion.emitir(USUARIO, "hash", CREADO, EXPIRA);

        token.marcarUsado();

        assertThat(token.isUsado()).isTrue();
        assertThat(token.estaVigente(CREADO)).isFalse();
    }

    @Test
    void rejectsInvalidConstruction() {
        assertThatThrownBy(() -> TokenRecuperacion.emitir(null, "hash", CREADO, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TokenRecuperacion.emitir(USUARIO, " ", CREADO, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TokenRecuperacion.emitir(USUARIO, "hash", CREADO, CREADO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
