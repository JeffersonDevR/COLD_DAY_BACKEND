package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-10 {@code ASIGNADA -> EN_CAMINO} (task 7.1). Only the assigned
 * technician may start the displacement; the guard is a domain authorization
 * check, so a forbidden caller must not persist anything.
 */
@ExtendWith(MockitoExtension.class)
class IniciarDesplazamientoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;

    private IniciarDesplazamientoUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = new IniciarDesplazamientoUseCase(otRepository, tecnicoRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void iniciarMovesTheAssignedOrderToEnCamino() {
        Tecnico tecnico = tecnico();
        Ot ot = otAsignada(tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.iniciar(PRINCIPAL, ot.getId());

        assertThat(response.estado()).isEqualTo(EstadoOt.EN_CAMINO);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.EN_CAMINO);
        });
    }

    @Test
    void iniciarRejectsANonAssignedTechnician() {
        Tecnico tecnico = tecnico();
        Ot ot = otAsignada(TecnicoId.nueva());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.iniciar(PRINCIPAL, otId))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verify(otRepository, never()).save(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
    }

    @Test
    void iniciarRejectsAnUnknownOrder() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.iniciar(PRINCIPAL, desconocida))
                .isInstanceOf(OtNoEncontradoException.class);
    }

    private Tecnico tecnico() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        return tecnico;
    }

    private Ot otAsignada(TecnicoId tecnicoId) {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.ASIGNADA, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null);
    }
}
