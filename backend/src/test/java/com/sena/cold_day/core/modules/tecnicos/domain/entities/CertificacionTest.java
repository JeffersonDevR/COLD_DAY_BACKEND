package com.sena.cold_day.core.modules.tecnicos.domain.entities;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

/**
 * Expiry rules of a certification (RF-F1-03, CU-03): it is vigente until its
 * expiry date passes, and vencido from the next day onwards.
 */
class CertificacionTest {

    @Test
    void isVigenteUpToAndIncludingTheExpiryDate() {
        Certificacion certificacion = new Certificacion("Tecnico", "SENA",
                LocalDate.of(2024, 1, 10), LocalDate.of(2026, 10, 1));

        assertThat(certificacion.estaVigente(LocalDate.of(2026, 9, 30))).isTrue();
        assertThat(certificacion.estaVigente(LocalDate.of(2026, 10, 1))).isTrue();
        assertThat(certificacion.estaVigente(LocalDate.of(2026, 10, 2))).isFalse();
    }

    @Test
    void aCertificationWithoutExpiryIsNotVigente() {
        Certificacion certificacion = new Certificacion("Tecnico", "SENA", LocalDate.of(2024, 1, 10));

        assertThat(certificacion.estaVigente(LocalDate.of(2026, 9, 13))).isFalse();
    }
}
