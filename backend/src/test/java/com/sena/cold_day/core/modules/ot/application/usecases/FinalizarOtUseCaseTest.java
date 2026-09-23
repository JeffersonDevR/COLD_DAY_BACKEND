package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtFinalizada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-10 finalization (task 7.7): the assigned technician finishes the repair,
 * the OT lands in FINALIZADA, the technician is released to DISPONIBLE and
 * {@link OtFinalizada} is published for tracking deactivation.
 */
@ExtendWith(MockitoExtension.class)
class FinalizarOtUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ApplicationEventPublisher events;
    @Mock MapsUseCase maps;

    private FinalizarOtUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = useCaseConTarifa(new TarifaProperties(0, 0, 0, null, null, 0, 0, null));
    }

    private FinalizarOtUseCase useCaseConTarifa(TarifaProperties props) {
        return new FinalizarOtUseCase(otRepository, tecnicoRepository, events,
                Clock.fixed(AHORA, ZoneOffset.UTC), new EstimarTarifaUseCase(maps, props));
    }

    @Test
    void finalizarCompletesTheOrderPublishesTheEventAndReleasesTheTechnician() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnReparacion(tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.finalizar(PRINCIPAL, ot.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);

        ArgumentCaptor<OtFinalizada> captor = ArgumentCaptor.forClass(OtFinalizada.class);
        verify(events).publishEvent(captor.capture());
        assertThat(captor.getValue().tecnicoAsignado()).contains(tecnico.getId());
    }

    @Test
    void finalizarRejectsANonAssignedTechnician() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnReparacion(TecnicoId.nueva());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.finalizar(PRINCIPAL, otId))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verify(otRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_REPARACION);
    }

    @Test
    void finalizarRejectsAnUnknownOrder() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.finalizar(PRINCIPAL, desconocida))
                .isInstanceOf(OtNoEncontradoException.class);
    }

    @Test
    void finalizarPersisteLaTarifaAutoritativaConSuDistanciaYFuente() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnReparacion(tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.finalizar(PRINCIPAL, ot.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(response.tarifaVisita()).isEqualByComparingTo("30000");
        assertThat(ot.getDistanciaKm()).isZero();
        assertThat(ot.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
    }

    @Test
    void unaConfiguracionDistintaCambiaLaTarifaPersistidaSinTocarElEsquema() {
        TarifaProperties props = new TarifaProperties(45000, 8, 30, new BigDecimal("80000"),
                new BigDecimal("100"), 7.8939, -72.5078, null);
        FinalizarOtUseCase useCaseConfigurado = useCaseConTarifa(props);
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnReparacion(tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCaseConfigurado.finalizar(PRINCIPAL, ot.getId());

        assertThat(response.tarifaVisita()).isEqualByComparingTo("45000");
    }

    /**
     * tar.R6 guard: a location-less OT (legacy row) has no destination to price,
     * so finalization persists no tariff, distance or source and never fails.
     */
    @Test
    void finalizarSinUbicacionNoPersisteTarifaYNoFalla() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnReparacionSinUbicacion(tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.finalizar(PRINCIPAL, ot.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.FINALIZADA);
        assertThat(response.tarifaVisita()).isNull();
        assertThat(ot.getDistanciaKm()).isNull();
        assertThat(ot.getTarifaFuente()).isNull();
    }

    private Tecnico tecnicoOcupado() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.aceptarOrden();
        return tecnico;
    }

    private Ot otEnReparacion(TecnicoId tecnicoId) {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8939, -72.5078), EstadoOt.EN_REPARACION,
                10.0, AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null);
    }

    private Ot otEnReparacionSinUbicacion(TecnicoId tecnicoId) {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", null, EstadoOt.EN_REPARACION,
                10.0, AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null);
    }
}
