package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoBloqueadoPorLiquidacionException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

/** El bloqueo por consignacion no se salta pasando por «fuera de servicio». */
@ExtendWith(MockitoExtension.class)
class CambiarDisponibilidadBloqueoTest {

    @Mock TecnicoRepository repository;
    @Mock LiquidacionRepository liquidaciones;

    private CambiarDisponibilidadUseCase useCase;
    private Tecnico tecnico;

    @BeforeEach
    void setUp() {
        useCase = new CambiarDisponibilidadUseCase(repository, liquidaciones);
        tecnico = Tecnico.crear(7L, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        when(repository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
    }

    @Test
    void conDeudaNoPuedeVolverADisponible() {
        tecnico.bloquearPorLiquidacion();
        tecnico.cambiarEstado(EstadoOperativo.FUERA_DE_SERVICIO);
        when(liquidaciones.existeBloqueadoraPara(tecnico.getId())).thenReturn(true);

        assertThatThrownBy(() -> useCase.cambiarEstado(tecnico.getId(), EstadoOperativo.DISPONIBLE))
                .isInstanceOf(TecnicoBloqueadoPorLiquidacionException.class)
                .hasMessageContaining("consignar");

        verify(repository, never()).save(any());
    }

    /** Orden finalizada antes de este cambio, sin liquidacion: no bloquea. */
    @Test
    void sinLiquidacionesPendientesPuedeActivarse() {
        when(liquidaciones.existeBloqueadoraPara(tecnico.getId())).thenReturn(false);

        useCase.cambiarEstado(tecnico.getId(), EstadoOperativo.DISPONIBLE);

        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
        verify(repository).save(tecnico);
    }
}
