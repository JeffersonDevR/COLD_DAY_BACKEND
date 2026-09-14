package com.sena.cold_day.core.modules.ot.domain.entities;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Domain behaviour of a dispatch offer (design D4/D6, RF-F1-09): one pending
 * offer per notified technician with a server-authoritative 60-second expiry.
 * An offer is vigente only while pending and before {@code expiraEn}.
 */
class OfertaOtTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(60);

    @Test
    void creationStartsPendingWithTheGivenWindow() {
        OfertaOt oferta = crear();

        assertThat(oferta.getId()).isNotNull();
        assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.PENDIENTE);
        assertThat(oferta.getCreadaEn()).isEqualTo(AHORA);
        assertThat(oferta.getExpiraEn()).isEqualTo(EXPIRA);
        assertThat(oferta.getResueltaEn()).isNull();
        assertThat(oferta.estaVigente(AHORA)).isTrue();
    }

    @Test
    void isNotVigenteAtOrAfterTheExpiryBoundary() {
        OfertaOt oferta = crear();

        assertThat(oferta.estaVigente(EXPIRA.minusMillis(1))).isTrue();
        assertThat(oferta.estaVigente(EXPIRA)).isFalse();
        assertThat(oferta.estaVigente(EXPIRA.plusSeconds(1))).isFalse();
    }

    @Test
    void expirarMovesPendingToExpiredAndStampsTheResolutionTime() {
        OfertaOt oferta = crear();

        oferta.expirar(EXPIRA);

        assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.EXPIRADA);
        assertThat(oferta.getResueltaEn()).isEqualTo(EXPIRA);
        assertThat(oferta.estaVigente(EXPIRA)).isFalse();
    }

    @Test
    void expirarRejectsAnAlreadyResolvedOffer() {
        OfertaOt oferta = crear();
        oferta.expirar(EXPIRA);
        Instant despues = EXPIRA.plusSeconds(1);

        assertThatThrownBy(() -> oferta.expirar(despues))
                .isInstanceOf(IllegalStateException.class);
        assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.EXPIRADA);
    }

    @Test
    void creationRequiresMandatoryData() {
        OtId otId = OtId.nueva();
        TecnicoId tecnicoId = TecnicoId.nueva();

        assertThatThrownBy(() -> OfertaOt.crear(null, tecnicoId, 10.0, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaOt.crear(otId, null, 10.0, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaOt.crear(otId, tecnicoId, 0.0, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaOt.crear(otId, tecnicoId, 10.0, null, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaOt.crear(otId, tecnicoId, 10.0, AHORA, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaOt.crear(otId, tecnicoId, 10.0, AHORA, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reconstitutionPreservesEveryField() {
        OfertaOtId id = OfertaOtId.nueva();
        OtId otId = OtId.nueva();
        TecnicoId tecnicoId = TecnicoId.nueva();

        OfertaOt oferta = OfertaOt.reconstituir(id, otId, tecnicoId, 15.0, OfertaEstado.EXPIRADA,
                AHORA, EXPIRA, EXPIRA);

        assertThat(oferta.getId()).isEqualTo(id);
        assertThat(oferta.getOtId()).isEqualTo(otId);
        assertThat(oferta.getTecnicoId()).isEqualTo(tecnicoId);
        assertThat(oferta.getRadioKm()).isEqualTo(15.0);
        assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.EXPIRADA);
        assertThat(oferta.getResueltaEn()).isEqualTo(EXPIRA);
    }

    private OfertaOt crear() {
        return OfertaOt.crear(OtId.nueva(), TecnicoId.nueva(), 10.0, AHORA, EXPIRA);
    }
}
