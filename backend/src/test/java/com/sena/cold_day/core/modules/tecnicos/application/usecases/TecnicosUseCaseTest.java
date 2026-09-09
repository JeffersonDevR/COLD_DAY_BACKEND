package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

@ExtendWith(MockitoExtension.class)
class TecnicosUseCaseTest {

    @Mock TecnicoRepository repository;
    @Mock ApplicationEventPublisher events;
    @Spy TecnicoMapper mapper = new TecnicoMapper();
    @InjectMocks RegistrarTecnicoUseCase registrar;
    @InjectMocks BuscarTecnicoUseCase buscar;
    @InjectMocks ActualizarTecnicoUseCase actualizar;
    @InjectMocks EliminarTecnicoUseCase eliminar;
    @InjectMocks CambiarDisponibilidadUseCase cambiarDisponibilidad;

    private TecnicoRequest request(String numeroIdentificacion) {
        return new TecnicoRequest(numeroIdentificacion, "Ana", "Garcia", "3001234567", "ana@example.com", null,
                Set.of(CategoriaServicio.REFRIGERACION),
                Set.of(new Certificacion("Tecnico en refrigeracion", "SENA", LocalDate.of(2027, 1, 31))));
    }

    @Test
    void crearAppliesDefaultsAndFields() {
        when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> {
            Tecnico tecnico = invocation.getArgument(0);
            return tecnico;
        });

        Tecnico saved = registrar.registrar(request("123"));
        assertThat(saved.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
        assertThat(saved.isActivo()).isTrue();
        assertThat(saved.getCategoriasServicio()).contains(CategoriaServicio.REFRIGERACION);
        assertThat(saved.getCertificaciones()).hasSize(1);
    }

    @Test
    void listarReturnsActiveTecnicos() {
        Tecnico tecnico = Tecnico.crear("123", "Ana", "Garcia", null, null, null, Set.of(), Set.of());
        when(repository.findByActivoTrue()).thenReturn(List.of(tecnico));
        assertThat(buscar.listar()).containsExactly(tecnico);
    }

    @Test
    void obtenerUnknownIdThrows() {
        when(repository.findByIdAndActivoTrue(999L)).thenReturn(Optional.empty());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> buscar.obtener(999L));
    }

    @Test
    void actualizarReplacesFields() {
        Tecnico existing = Tecnico.reconstituir(5L, "123", "Ana", "Garcia", null, null, null, Set.of(),
                EstadoOperativo.OCUPADO, Set.of(), true);
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Tecnico updated = actualizar.actualizar(5L, request("456"));
        assertThat(updated.getNumeroIdentificacion()).isEqualTo("456");
        assertThat(updated.getEstadoOperativo()).isEqualTo(EstadoOperativo.OCUPADO);
        verify(repository).save(existing);
    }

    @Test
    void eliminarSetsActivoFalse() {
        Tecnico existing = Tecnico.crear("123", "Ana", "Garcia", null, null, null, Set.of(), Set.of());
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        eliminar.eliminar(5L);
        assertThat(existing.isActivo()).isFalse();
        verify(repository).save(existing);
    }

    @Test
    void cambiarDisponibilidadUpdatesOperationalState() {
        Tecnico existing = Tecnico.crear("123", "Ana", "Garcia", null, null, null, Set.of(), Set.of());
        when(repository.findByIdAndActivoTrue(5L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);
        cambiarDisponibilidad.cambiarEstado(5L, EstadoOperativo.OCUPADO);
        assertThat(existing.getEstadoOperativo()).isEqualTo(EstadoOperativo.OCUPADO);
        verify(repository).save(existing);
    }
}
