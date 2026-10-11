package com.sena.cold_day.core.modules.tecnicos.domain.entities;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Approval validity (M7): a document is vigente only when it carries a
 * fecha_expedicion and, when a fecha_vencimiento is set, that expiry is not in
 * the past. A null expiry is allowed.
 */
class DocumentoTecnicoTest {

    private static final TecnicoId TECNICO_ID = TecnicoId.desde(UUID.randomUUID());
    private static final LocalDate HOY = LocalDate.of(2026, 10, 10);

    private DocumentoTecnico documento(LocalDate expedicion, LocalDate vencimiento) {
        return new DocumentoTecnico(1L, TECNICO_ID, "CEDULA", expedicion, vencimiento);
    }

    @Test
    void vigenteWhenExpedicionPresentAndExpiryIsNull() {
        assertThat(documento(LocalDate.of(2024, 1, 1), null).estaVigente(HOY)).isTrue();
    }

    @Test
    void vigenteWhenExpiryIsInTheFuture() {
        assertThat(documento(LocalDate.of(2024, 1, 1), HOY.plusDays(1)).estaVigente(HOY)).isTrue();
    }

    @Test
    void vigenteOnTheExpiryDayItself() {
        assertThat(documento(LocalDate.of(2024, 1, 1), HOY).estaVigente(HOY)).isTrue();
    }

    @Test
    void notVigenteWhenExpedicionIsMissing() {
        assertThat(documento(null, HOY.plusDays(30)).estaVigente(HOY)).isFalse();
    }

    @Test
    void notVigenteWhenExpired() {
        assertThat(documento(LocalDate.of(2024, 1, 1), HOY.minusDays(1)).estaVigente(HOY)).isFalse();
    }
}
