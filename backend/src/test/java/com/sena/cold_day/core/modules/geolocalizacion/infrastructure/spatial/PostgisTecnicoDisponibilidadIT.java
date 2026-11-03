package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.spatial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
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
 * PostGIS adapter boundary tests (RF-F1-07, RNF-03, RF-F1-27): {@code ST_DWithin}
 * radius filtering, {@code ST_Distance} ordering and eligibility rules against a
 * real PostgreSQL/PostGIS (Testcontainers, see {@code PostgisContainerInitializer}),
 * including the radar's tracking and location-freshness rules.
 */
@SpringBootTest
class PostgisTecnicoDisponibilidadIT {

    private static final Point BOGOTA = new Point(4.6, -74.0);

    @Autowired TecnicoDisponibilidadRepository disponibilidad;
    @Autowired SpringDataTecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void limpieza() {
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void filtraPorRadioYOrdenaPorDistanciaPostgis() {
        persistirTecnico(4.62, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION)); // ~2.2 km
        UUID cercano = persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION)); // ~1.1 km
        persistirTecnico(5.0, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION)); // ~44 km, fuera

        var resultados = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION), marcaDeVigencia());

        SoftAssertions.assertSoftly(softly -> {
            softly.assertThat(resultados).hasSize(2);
            softly.assertThat(resultados.get(0).tecnicoId().valor()).isEqualTo(cercano);
            softly.assertThat(resultados.get(0).distanciaKm()).isCloseTo(1.11, within(0.2));
            softly.assertThat(resultados.get(1).distanciaKm()).isCloseTo(2.22, within(0.2));
        });
    }

    @Test
    void excluyeNoDisponiblesYNulos() {
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.OCUPADO,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(4.61, -74.0, EstadoValidacion.PENDIENTE, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(null, null, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        UUID disponible = persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));

        var resultados = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION), marcaDeVigencia());

        assertThat(resultados).hasSize(1);
        assertThat(resultados.get(0).tecnicoId().valor()).isEqualTo(disponible);
    }

    @Test
    void respetaElFiltroDeCategorias() {
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        UUID electrico = persistirTecnico(4.62, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.ELECTRICIDAD));

        var soloElectricidad = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.ELECTRICIDAD), marcaDeVigencia());

        assertThat(soloElectricidad).extracting(TecnicoCercano::tecnicoId)
                .containsExactly(new TecnicoId(electrico));
    }

    /**
     * A technician who pressed "stop sharing location" keeps the last
     * coordinates for audit, but must stop appearing in the radar: dispatch
     * would otherwise offer work to someone the client cannot see moving.
     */
    @Test
    void excluyeTecnicosQueDetuvieronElTracking() {
        UUID compartiendo = persistirTecnicoConTracking(4.61, -74.0, true, Instant.now());
        persistirTecnicoConTracking(4.62, -74.0, false, Instant.now());

        var resultados = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION), marcaDeVigencia());

        assertThat(resultados).extracting(TecnicoCercano::tecnicoId)
                .containsExactly(new TecnicoId(compartiendo));
    }

    /**
     * Same rule for stale reports: coordinates older than
     * {@link Tecnico#UBICACION_VIGENCIA} (or never reported at all) are not a
     * live position, so they are filtered out even when tracking is on.
     */
    @Test
    void excluyeTecnicosCuyaUbicacionDejoDeSerVigente() {
        UUID vigente = persistirTecnicoConTracking(4.61, -74.0, true, Instant.now());
        persistirTecnicoConTracking(4.62, -74.0, true,
                Instant.now().minus(Tecnico.UBICACION_VIGENCIA).minusSeconds(60));
        persistirTecnicoConTracking(4.63, -74.0, true, null);

        var resultados = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION), marcaDeVigencia());

        assertThat(resultados).extracting(TecnicoCercano::tecnicoId)
                .containsExactly(new TecnicoId(vigente));
    }

    /** Boundary sanity of the 2-minute window a radar reader passes in. */
    @Test
    void respetaElMargenDeVigenciaDeLaUbicacion() {
        UUID haceUnMinuto = persistirTecnicoConTracking(4.61, -74.0, true,
                Instant.now().minusSeconds(60));
        persistirTecnicoConTracking(4.62, -74.0, true, Instant.now().minusSeconds(180));

        var resultados = disponibilidad.buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION), marcaDeVigencia());

        assertThat(resultados).extracting(TecnicoCercano::tecnicoId)
                .containsExactly(new TecnicoId(haceUnMinuto));
    }

    /** The lower bound shared by the radar and the aggregate's freshness rule. */
    private static Instant marcaDeVigencia() {
        return Tecnico.desdeVigenciaUbicacion(Instant.now());
    }

    private UUID persistirTecnicoConTracking(Double latitud, Double longitud, boolean trackingActivo,
            Instant ubicacionActualizadaEn) {
        return persistirTecnico(latitud, longitud, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION), trackingActivo, ubicacionActualizadaEn);
    }

    private UUID persistirTecnico(Double latitud, Double longitud, EstadoValidacion validacion,
            EstadoOperativo operativo, Set<CategoriaServicio> categorias) {
        return persistirTecnico(latitud, longitud, validacion, operativo, categorias, true, Instant.now());
    }

    private UUID persistirTecnico(Double latitud, Double longitud, EstadoValidacion validacion,
            EstadoOperativo operativo, Set<CategoriaServicio> categorias, boolean trackingActivo,
            Instant ubicacionActualizadaEn) {
        Long usuarioId = persistirUsuario();
        TecnicoJpaEntity tecnico = new TecnicoJpaEntity();
        tecnico.setId(UUID.randomUUID());
        tecnico.setUsuarioId(usuarioId);
        tecnico.setNumeroIdentificacion("PG-" + tecnico.getId());
        tecnico.setEstadoValidacion(validacion);
        tecnico.setEstadoOperativo(operativo);
        tecnico.setCategoriasServicio(new HashSet<>(categorias));
        tecnico.setLatitud(latitud);
        tecnico.setLongitud(longitud);
        tecnico.setActivo(true);
        tecnico.setTrackingActivo(trackingActivo);
        tecnico.setUbicacionActualizadaEn(ubicacionActualizadaEn);
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
