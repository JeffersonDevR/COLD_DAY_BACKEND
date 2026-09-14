package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OfertaOtRepositoryAdapter;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Persistence boundary of {@code oferta_ot} (design D4/D5). The conditional
 * accept lives in Spring Data (WHERE estado='PENDIENTE' AND expira_en > ahora),
 * so the winner/loser decision is a single atomic statement.
 */
@DataJpaTest
@Import(OfertaOtRepositoryAdapter.class)
class OfertaOtRepositoryTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(60);

    @Autowired OfertaOtRepositoryAdapter repository;
    @Autowired SpringDataOfertaOtRepository springData;

    @BeforeEach
    void cleanup() {
        springData.deleteAll();
    }

    @Test
    void savesAndFindsByIdRoundTrippingTheOffer() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        OfertaOt saved = repository.save(crearPendiente(OtId.nueva(), tecnicoId, 10.0, EXPIRA));

        assertThat(repository.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getTecnicoId()).isEqualTo(tecnicoId);
            assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE);
            assertThat(found.getRadioKm()).isEqualTo(10.0);
            assertThat(found.getCreadaEn()).isEqualTo(AHORA);
            assertThat(found.getExpiraEn()).isEqualTo(EXPIRA);
            assertThat(found.getResueltaEn()).isNull();
        });
    }

    @Test
    void listarPendientesPorOtReturnsOnlyPendingOffersOfThatOrder() {
        OtId otId = OtId.nueva();
        OtId otraOt = OtId.nueva();
        repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        OfertaOt resuelta = repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        repository.intentarAceptar(resuelta.getId(), AHORA);
        repository.save(crearPendiente(otraOt, TecnicoId.nueva(), 10.0, EXPIRA));

        List<OfertaOt> pendientes = repository.listarPendientesPorOt(otId);

        assertThat(pendientes).hasSize(1);
        assertThat(pendientes.get(0).getId()).isNotEqualTo(resuelta.getId());
        assertThat(pendientes).allSatisfy(oferta -> assertThat(oferta.getEstado())
                .isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void listarPorTecnicoFiltersByTheRequestedStates() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        repository.save(crearPendiente(OtId.nueva(), tecnicoId, 10.0, EXPIRA));
        OfertaOt expirada = repository.save(crearPendiente(OtId.nueva(), tecnicoId, 10.0, EXPIRA));
        repository.expirarDe(expirada.getOtId(), AHORA);
        repository.save(crearPendiente(OtId.nueva(), TecnicoId.nueva(), 10.0, EXPIRA));

        assertThat(repository.listarPorTecnico(tecnicoId)).hasSize(2);
        assertThat(repository.listarPorTecnico(tecnicoId, OfertaEstado.PENDIENTE))
                .singleElement()
                .satisfies(oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
        assertThat(repository.listarPorTecnico(tecnicoId, OfertaEstado.EXPIRADA))
                .singleElement()
                .satisfies(oferta -> assertThat(oferta.getId()).isEqualTo(expirada.getId()));
    }

    @Test
    void intentarAceptarWinsForAPendingUnexpiredOfferExactlyOnce() {
        OfertaOt oferta = repository.save(crearPendiente(OtId.nueva(), TecnicoId.nueva(), 10.0, EXPIRA));

        int ganador = repository.intentarAceptar(oferta.getId(), AHORA);
        int repetido = repository.intentarAceptar(oferta.getId(), AHORA);

        assertThat(ganador).isEqualTo(1);
        assertThat(repetido).isZero();
        assertThat(repository.buscarPorId(oferta.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaEstado.ACEPTADA);
            assertThat(found.getResueltaEn()).isEqualTo(AHORA);
        });
    }

    @Test
    void intentarAceptarRejectsAnOfferWhoseWindowExpired() {
        OfertaOt oferta = repository.save(crearPendiente(OtId.nueva(), TecnicoId.nueva(), 10.0, EXPIRA));

        int filas = repository.intentarAceptar(oferta.getId(), EXPIRA);

        assertThat(filas).isZero();
        assertThat(repository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void intentarAceptarReturnsZeroForAnUnknownOffer() {
        assertThat(repository.intentarAceptar(OfertaOtId.nueva(), AHORA)).isZero();
    }

    @Test
    void expirarDeClosesOnlyPendingOffersOfThatOrder() {
        OtId otId = OtId.nueva();
        OfertaOt pendiente = repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        OfertaOt aceptada = repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        repository.intentarAceptar(aceptada.getId(), AHORA);
        OfertaOt ajena = repository.save(crearPendiente(OtId.nueva(), TecnicoId.nueva(), 10.0, EXPIRA));

        repository.expirarDe(otId, EXPIRA);

        assertThat(repository.buscarPorId(pendiente.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaEstado.EXPIRADA);
            assertThat(found.getResueltaEn()).isEqualTo(EXPIRA);
        });
        assertThat(repository.buscarPorId(aceptada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.ACEPTADA));
        assertThat(repository.buscarPorId(ajena.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void invalidarPendientesDeCancelsOnlyPendingOffersOfThatOrder() {
        OtId otId = OtId.nueva();
        OfertaOt pendiente = repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        OfertaOt aceptada = repository.save(crearPendiente(otId, TecnicoId.nueva(), 10.0, EXPIRA));
        repository.intentarAceptar(aceptada.getId(), AHORA);

        repository.invalidarPendientesDe(otId, OfertaEstado.CANCELADA, AHORA);

        assertThat(repository.buscarPorId(pendiente.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaEstado.CANCELADA);
            assertThat(found.getResueltaEn()).isEqualTo(AHORA);
        });
        assertThat(repository.buscarPorId(aceptada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.ACEPTADA));
    }

    private OfertaOt crearPendiente(OtId otId, TecnicoId tecnicoId, double radioKm, Instant expiraEn) {
        return OfertaOt.crear(otId, tecnicoId, radioKm, AHORA, expiraEn);
    }
}
