package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

/** El reconciliador no escribe el agregado que leyo: podria borrar un bloqueo. */
@ExtendWith(MockitoExtension.class)
class ReconciliarTecnicosOcupadosUseCaseTest {

    @Mock TecnicoRepository tecnicoRepository;
    @Mock OtRepository otRepository;
    @InjectMocks ReconciliarTecnicosOcupadosUseCase useCase;

    private Tecnico tecnicoOcupado() {
        Tecnico tecnico = Tecnico.crear(7L, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.cambiarEstado(EstadoOperativo.OCUPADO);
        when(tecnicoRepository.findByActivoTrue()).thenReturn(List.of(tecnico));
        return tecnico;
    }

    @Test
    void liberaConEscrituraCondicional() {
        Tecnico tecnico = tecnicoOcupado();
        when(tecnicoRepository.liberarSiOcupado(tecnico.getId())).thenReturn(1);

        assertThat(useCase.ejecutar()).isEqualTo(1);

        verify(tecnicoRepository, never()).save(any());
    }

    /** La fila ya cambio (finalizar lo bloqueo mientras se revisaban sus ordenes). */
    @Test
    void siYaNoEstaOcupadoNoCuentaNiEscribe() {
        Tecnico tecnico = tecnicoOcupado();
        when(tecnicoRepository.liberarSiOcupado(tecnico.getId())).thenReturn(0);

        assertThat(useCase.ejecutar()).isZero();

        verify(tecnicoRepository, never()).save(any());
    }
}
