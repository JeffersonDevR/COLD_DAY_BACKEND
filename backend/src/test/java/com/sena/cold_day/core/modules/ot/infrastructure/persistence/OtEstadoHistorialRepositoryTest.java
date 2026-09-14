package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.hibernate.annotations.Immutable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OtEstadoHistorialRepositoryAdapter;

/**
 * RNF-09 append-only history: entries record actor, timestamp, origin and
 * destination; the port exposes no update or delete operation and the entity is
 * Hibernate-immutable.
 */
@DataJpaTest
@Import(OtEstadoHistorialRepositoryAdapter.class)
class OtEstadoHistorialRepositoryTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Autowired OtEstadoHistorialRepository repository;
    @Autowired SpringDataOtEstadoHistorialRepository springData;

    @BeforeEach
    void cleanup() {
        springData.deleteAll();
    }

    @Test
    void appendsAndListsByOtInChronologicalOrder() {
        OtId otId = OtId.nueva();
        repository.append(OtEstadoHistorial.registrar(otId,
                new CambioEstado(null, EstadoOt.SOLICITADA, ActorOt.CLIENTE, AHORA, null)));
        repository.append(OtEstadoHistorial.registrar(otId,
                new CambioEstado(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO, ActorOt.CLIENTE,
                        AHORA.plusSeconds(1), null)));

        List<OtEstadoHistorial> historial = repository.listarPorOt(otId);

        assertThat(historial).hasSize(2);
        assertThat(historial).extracting(entrada -> entrada.getCambio().destino())
                .containsExactly(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO);
        assertThat(historial.get(0).getCambio().origen()).isNull();
        assertThat(historial.get(0).getCambio().actor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(historial.get(0).getCambio().ocurridoEn()).isEqualTo(AHORA);
  }

    @Test
    void listarPorOtIsEmptyForAnUnknownOrder() {
        assertThat(repository.listarPorOt(OtId.nueva())).isEmpty();
    }

    @Test
    void thePortExposesOnlyAppendAndListarPorOt() {
        var operaciones = Arrays.stream(OtEstadoHistorialRepository.class.getDeclaredMethods())
                .map(Method::getName)
                .sorted()
                .toList();

        assertThat(operaciones).containsExactly("append", "listarPorOt");
    }

    @Test
    void theJpaEntityIsImmutable() {
        assertThat(OtEstadoHistorialJpaEntity.class.isAnnotationPresent(Immutable.class)).isTrue();
    }
}
