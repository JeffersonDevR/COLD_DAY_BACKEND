package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OtEstadoHistorialRepositoryAdapter;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OtRepositoryAdapter;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Persistence boundary for the {@code ot} aggregate and its append-only history
 * (design D3/D5, RNF-09). The conditional update lives in the adapter, not in
 * the domain.
 */
@DataJpaTest
@Import({OtRepositoryAdapter.class, OtEstadoHistorialRepositoryAdapter.class})
class OtRepositoryTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Autowired OtRepositoryAdapter repository;
    @Autowired SpringDataOtRepository springData;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;

    @BeforeEach
    void cleanup() {
        springDataHistorial.deleteAll();
        springData.deleteAll();
    }

    @Test
    void savesAndFindsByIdRoundTrippingTheAggregate() {
        Ot saved = repository.save(crearEnSolicitada());

        assertThat(repository.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getClienteId()).isEqualTo(saved.getClienteId());
            assertThat(found.getEstado()).isEqualTo(EstadoOt.SOLICITADA);
            assertThat(found.getCategoriaServicio()).isEqualTo(CategoriaServicio.REFRIGERACION);
            assertThat(found.getDescripcionFalla()).isEqualTo("No enciende");
            assertThat(found.getEvidenciaUrls()).containsExactly("http://foto");
            assertThat(found.getUbicacion()).isEqualTo(new Point(4.6, -74.0));
            assertThat(found.getCreadaEn()).isEqualTo(AHORA);
            assertThat(found.getTecnicoId()).isNull();
        });
    }

    @Test
    void findsByStateWithoutReturningOtherStates() {
        repository.save(crearEnSolicitada());
        repository.save(crearBuscandoTecnico(AHORA.plusSeconds(60)));

        assertThat(repository.buscarPorEstado(EstadoOt.BUSCANDO_TECNICO))
                .singleElement()
                .satisfies(ot -> assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO));
        assertThat(repository.buscarPorEstado(EstadoOt.SOLICITADA)).hasSize(1);
    }

    @Test
    void buscarVentanasVencidasReturnsOnlyExpiredSearchingOrders() {
        repository.save(crearBuscandoTecnico(AHORA.minusSeconds(1)));
        repository.save(crearBuscandoTecnico(AHORA.plusSeconds(60)));

        assertThat(repository.buscarVentanasVencidas(AHORA))
                .singleElement()
                .satisfies(ot -> assertThat(ot.getVentanaExpiraEn()).isBeforeOrEqualTo(AHORA));
    }

    @Test
    void intentarAsignarWinsOnlyForTheSearchingOrder() {
        Ot ot = repository.save(crearBuscandoTecnico(AHORA.plusSeconds(60)));
        TecnicoId tecnicoId = TecnicoId.nueva();

        int ganador = repository.intentarAsignar(ot.getId(), tecnicoId, AHORA, 10.0);
        int repetido = repository.intentarAsignar(ot.getId(), TecnicoId.nueva(), AHORA, 10.0);

        assertThat(ganador).isEqualTo(1);
        assertThat(repetido).isZero();
        assertThat(repository.buscarPorId(ot.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(found.getTecnicoId()).isEqualTo(tecnicoId);
            assertThat(found.getAsignadaEn()).isEqualTo(AHORA);
        });
    }

    @Test
    void intentarAsignarReturnsZeroForAnUnknownOrder() {
        assertThat(repository.intentarAsignar(OtId.nueva(), TecnicoId.nueva(), AHORA, 10.0)).isZero();
    }

    @Test
    void intentarAsignarPersistsTheAuxiliarCountInTheSameConditionalUpdate() {
        Ot ot = repository.save(crearBuscandoTecnico(AHORA.plusSeconds(60)));

        int ganador = repository.intentarAsignar(ot.getId(), TecnicoId.nueva(), AHORA, 10.0, 3);

        assertThat(ganador).isEqualTo(1);
        assertThat(repository.buscarPorId(ot.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(found.getAuxiliaresRequeridos()).isEqualTo(3);
        });
    }

    @Test
    void intentarAsignarDefaultsTheAuxiliarCountToZeroOnTheDelegatingOverload() {
        Ot ot = repository.save(crearBuscandoTecnico(AHORA.plusSeconds(60)));

        int ganador = repository.intentarAsignar(ot.getId(), TecnicoId.nueva(), AHORA, 10.0);

        assertThat(ganador).isEqualTo(1);
        assertThat(repository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getAuxiliaresRequeridos()).isZero());
    }

    @Test
    void saveDrainsPendingStateChangesIntoTheAppendOnlyHistory() {
        Ot ot = repository.save(crearEnSolicitada());
        ot.iniciarBusqueda(10.0, AHORA.plusSeconds(60), ActorOt.CLIENTE, AHORA);

        repository.save(ot);

        var historial = springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor());
        assertThat(historial).hasSize(2);
        assertThat(historial).extracting(OtEstadoHistorialJpaEntity::getEstadoDestino)
                .containsExactly(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO);
        assertThat(historial.get(0).getEstadoOrigen()).isNull();
        assertThat(historial.get(1).getEstadoOrigen()).isEqualTo(EstadoOt.SOLICITADA);
    }

    @Test
    void roundTripsTheDiagnosisAndBudgetJsonColumns() {
        Diagnostico diagnostico = new Diagnostico("Compresor averiado", "Revisado en sitio", AHORA);
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"), AHORA);
        Ot ot = Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), TecnicoId.nueva(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0),
                EstadoOt.EN_DIAGNOSTICO, 10.0, AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null,
                diagnostico, presupuesto);

        repository.save(ot);

        assertThat(repository.buscarPorId(ot.getId())).hasValueSatisfying(found -> {
            assertThat(found.getDiagnostico()).isEqualTo(diagnostico);
            assertThat(found.getPresupuesto()).isEqualTo(presupuesto);
        });
    }

    private Ot crearEnSolicitada() {
        return Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of("http://foto"),
                "Calle 1", new Point(4.6, -74.0), AHORA);
    }

    private Ot crearBuscandoTecnico(Instant ventanaExpiraEn) {
        Ot ot = crearEnSolicitada();
        ot.iniciarBusqueda(10.0, ventanaExpiraEn, ActorOt.CLIENTE, AHORA);
        return ot;
    }
}
