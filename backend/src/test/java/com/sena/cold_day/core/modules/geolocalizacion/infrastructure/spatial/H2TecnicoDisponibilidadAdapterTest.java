package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.spatial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * H2 spatial adapter boundary tests (RF-F1-07, design D9): bounding box plus
 * Haversine filtering over available, approved technicians. The port exposes
 * only value objects; JPA stays inside the adapter.
 */
@DataJpaTest
@Import(H2TecnicoDisponibilidadAdapter.class)
class H2TecnicoDisponibilidadAdapterTest {

    private static final Point BOGOTA = new Point(4.6, -74.0);

    @Autowired H2TecnicoDisponibilidadAdapter adapter;
    @Autowired SpringDataTecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    void cleanup() {
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void returnsOnlyTechniciansInsideTheRadius() {
        UUID cercano = persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(5.0, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));

        var resultados = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of(CategoriaServicio.REFRIGERACION));

        assertThat(resultados).hasSize(1);
        TecnicoCercano tecnicoCercano = resultados.get(0);
        assertThat(tecnicoCercano.tecnicoId().valor()).isEqualTo(cercano);
        assertThat(tecnicoCercano.distanciaKm()).isCloseTo(1.11, within(0.2));
    }

    @Test
    void honorsTheRadiusBoundary() {
        persistirTecnico(4.645, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION)); // ~5 km
        persistirTecnico(4.708, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION)); // ~12 km

        var resultados = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of(CategoriaServicio.REFRIGERACION));

        assertThat(resultados).extracting(TecnicoCercano::distanciaKm)
                .allSatisfy(distancia -> assertThat(distancia).isLessThanOrEqualTo(10.0));
        assertThat(resultados).hasSize(1);
        assertThat(resultados.get(0).distanciaKm()).isCloseTo(5.0, within(0.5));
    }

    @Test
    void excludesNonAvailableOrUnapprovedTechnicians() {
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.OCUPADO,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.FUERA_DE_SERVICIO,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(4.61, -74.0, EstadoValidacion.SUSPENDIDO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(4.61, -74.0, EstadoValidacion.PENDIENTE, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        UUID disponible = persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));

        var resultados = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of(CategoriaServicio.REFRIGERACION));

        assertThat(resultados).hasSize(1);
        assertThat(resultados.get(0).tecnicoId().valor()).isEqualTo(disponible);
    }

    @Test
    void excludesTechniciansWithoutCoordinates() {
        persistirTecnico(null, null, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));

        var resultados = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of(CategoriaServicio.REFRIGERACION));

        assertThat(resultados).isEmpty();
    }

    @Test
    void filtersByTheRequestedCategories() {
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        UUID electrico = persistirTecnico(4.62, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.ELECTRICIDAD));

        var soloElectricidad = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of(CategoriaServicio.ELECTRICIDAD));
        assertThat(soloElectricidad).extracting(TecnicoCercano::tecnicoId)
                .containsExactly(new TecnicoId(electrico));

        var todasLasCategorias = adapter.buscarDisponiblesEnRadio(BOGOTA, 10.0, Set.of());
        assertThat(todasLasCategorias).hasSize(2);
    }

    private UUID persistirTecnico(Double latitud, Double longitud, EstadoValidacion validacion,
            EstadoOperativo operativo, Set<CategoriaServicio> categorias) {
        Long usuarioId = persistirUsuario();
        TecnicoJpaEntity tecnico = new TecnicoJpaEntity();
        tecnico.setId(UUID.randomUUID());
        tecnico.setUsuarioId(usuarioId);
        tecnico.setNumeroIdentificacion("ID-" + tecnico.getId());
        tecnico.setEstadoValidacion(validacion);
        tecnico.setEstadoOperativo(operativo);
        tecnico.setCategoriasServicio(new HashSet<>(categorias));
        tecnico.setLatitud(latitud);
        tecnico.setLongitud(longitud);
        tecnico.setActivo(true);
        return tecnicoRepository.save(tecnico).getId();
    }

    private Long persistirUsuario() {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", UUID.randomUUID() + "@example.com", "secreto", null, null,
                Rol.TECNICO, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }
}
