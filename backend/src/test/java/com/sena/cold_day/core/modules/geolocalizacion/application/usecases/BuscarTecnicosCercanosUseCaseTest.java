package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/** Radar of available technicians within a radius (RF-F1-04, RF-F1-07). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BuscarTecnicosCercanosUseCaseTest {

    @Mock TecnicoDisponibilidadRepository disponibilidadRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock UsuarioRepository usuarioRepository;

    private BuscarTecnicosCercanosUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new BuscarTecnicosCercanosUseCase(disponibilidadRepository, tecnicoRepository, usuarioRepository);
    }

    @Test
    void buscarEnrichesAvailableTechniciansWithContactData() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        when(disponibilidadRepository.buscarDisponiblesEnRadio(any(), anyDouble(), any()))
                .thenReturn(List.of(new TecnicoCercano(tecnicoId, 2.5)));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .thenReturn(Optional.of(tecnico(tecnicoId, 7L)));
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(7L, "Luis")));

        var response = useCase.buscar(new Point(7.8, -72.5), 5.0, Set.of(CategoriaServicio.REFRIGERACION));

        assertThat(response).hasSize(1);
        assertThat(response.get(0).nombre()).isEqualTo("Luis");
        assertThat(response.get(0).telefono()).isEqualTo("3001234567");
        assertThat(response.get(0).distanciaKm()).isEqualTo(2.5);
        assertThat(response.get(0).disponible()).isTrue();
    }

    @Test
    void buscarFallsBackToAPlaceholderNameWhenTheUsuarioIsMissing() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        when(disponibilidadRepository.buscarDisponiblesEnRadio(any(), anyDouble(), any()))
                .thenReturn(List.of(new TecnicoCercano(tecnicoId, 1.0)));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .thenReturn(Optional.of(tecnico(tecnicoId, 7L)));
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.empty());

        var response = useCase.buscar(new Point(7.8, -72.5), 5.0, Set.of());

        assertThat(response).hasSize(1);
        assertThat(response.get(0).nombre()).isEqualTo("Técnico");
        assertThat(response.get(0).telefono()).isNull();
    }

    @Test
    void buscarSkipsProjectionsWithoutAnActiveTechnician() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        when(disponibilidadRepository.buscarDisponiblesEnRadio(any(), anyDouble(), any()))
                .thenReturn(List.of(new TecnicoCercano(tecnicoId, 1.0)));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.empty());

        assertThat(useCase.buscar(new Point(7.8, -72.5), 5.0, Set.of())).isEmpty();
    }

    private Tecnico tecnico(TecnicoId id, Long usuarioId) {
        return Tecnico.reconstituir(id, usuarioId, "1098765001", Set.of(CategoriaServicio.REFRIGERACION),
                EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO, null, Set.of(), true,
                new Point(7.8, -72.5), false, null);
    }

    private Usuario usuario(Long id, String nombre) {
        return Usuario.reconstituir(id, nombre, "correo@example.com", "hash", "3001234567", null,
                Rol.TECNICO, java.time.LocalDateTime.now(), true, true, 0);
    }
}
