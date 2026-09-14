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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.DiagnosticoRequest;
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
 * RF-F1-11 (task 7.3): the assigned technician records the fault and presents
 * the budget, moving {@code EN_CAMINO -> EN_DIAGNOSTICO}. A non-assigned
 * technician is a 403 and nothing is persisted.
 */
@ExtendWith(MockitoExtension.class)
class RegistrarDiagnosticoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock TecnicoRepository tecnicoRepository;

    private RegistrarDiagnosticoUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = new RegistrarDiagnosticoUseCase(otRepository, tecnicoRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void registrarPersistsTheDiagnosisAndPresentsTheBudget() {
        Tecnico tecnico = tecnico();
        Ot ot = otAsignada(tecnico.getId(), EstadoOt.EN_CAMINO);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OtResponse response = useCase.registrar(PRINCIPAL, ot.getId(), new DiagnosticoRequest(
                "Compresor averiado", "Revisado en sitio", new BigDecimal("120000.00"),
                new BigDecimal("350000.00")));

        assertThat(response.estado()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
        assertThat(response.diagnostico().fallaDetectada()).isEqualTo("Compresor averiado");
        assertThat(response.diagnostico().registradoEn()).isEqualTo(AHORA);
        assertThat(response.presupuesto().costoManoObra()).isEqualByComparingTo("120000.00");
        assertThat(response.presupuesto().costoRepuestos()).isEqualByComparingTo("350000.00");
    }

    @Test
    void registrarRejectsANonAssignedTechnicianAndPersistsNothing() {
        Tecnico tecnico = tecnico();
        Ot ot = otAsignada(TecnicoId.nueva(),
                EstadoOt.EN_CAMINO);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));

        assertThatThrownBy(() -> useCase.registrar(PRINCIPAL, ot.getId(), new DiagnosticoRequest(
                "Falla", null, BigDecimal.ONE, BigDecimal.ONE)))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verify(otRepository, never()).save(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
    }

    @Test
    void registrarRejectsAnUnknownOrder() {
        OtId desconocida = OtId.nueva();
        when(otRepository.buscarPorId(desconocida)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.registrar(PRINCIPAL, desconocida, new DiagnosticoRequest(
                "Falla", null, BigDecimal.ONE, BigDecimal.ONE)))
                .isInstanceOf(OtNoEncontradoException.class);
    }

    private Tecnico tecnico() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        return tecnico;
    }

    private Ot otAsignada(TecnicoId tecnicoId,
            EstadoOt estado) {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), estado, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null);
    }
}
