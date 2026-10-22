package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * The OT read has to carry the audit trail with it: the client renders the
 * timeline of the order from the same read it already makes, so a history that
 * stays in the server leaves the timeline empty against the real backend.
 */
@ExtendWith(MockitoExtension.class)
class ConsultarOtUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-10-21T12:00:00Z");

    @Mock OtRepository otRepository;
    @Mock OtEstadoHistorialRepository historialRepository;
    @Mock TecnicoRepository tecnicoRepository;

    private ConsultarOtUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ConsultarOtUseCase(otRepository, historialRepository, tecnicoRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void laOrdenSeDevuelveConSuHistorialDeEstados() {
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), AHORA);
        CambioEstado creacion = CambioEstado.hacia(null, EstadoOt.SOLICITADA, ActorOt.CLIENTE, AHORA);
        CambioEstado busqueda = CambioEstado.hacia(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO,
                ActorOt.CLIENTE, AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(historialRepository.listarPorOt(ot.getId())).thenReturn(List.of(
                OtEstadoHistorial.reconstituir(1L, ot.getId(), creacion, null, null),
                OtEstadoHistorial.reconstituir(2L, ot.getId(), busqueda, null, null)));

        var resultado = useCase.consultar(ot.getId());

        assertThat(resultado.historial()).hasSize(2);
        assertThat(resultado.historial().get(0).destino()).isEqualTo(EstadoOt.SOLICITADA);
        assertThat(resultado.historial().get(0).actor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(resultado.historial().get(1).origen()).isEqualTo(EstadoOt.SOLICITADA);
        assertThat(resultado.historial().get(1).destino()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
    }

    @Test
    void unaOrdenSinHistorialDevuelveElHistorialVacioYNoFalla() {
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(historialRepository.listarPorOt(ot.getId())).thenReturn(List.of());

        var resultado = useCase.consultar(ot.getId());

        assertThat(resultado.historial()).isEmpty();
    }
}
