package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;

import org.assertj.core.api.SoftAssertions;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.geolocalizacion.infrastructure.spatial.H2TecnicoDisponibilidadAdapter;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.infrastructure.notification.LoggingNotificacionPushAdapter;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OfertaOtRepositoryAdapter;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OtEstadoHistorialRepositoryAdapter;
import com.sena.cold_day.core.modules.ot.infrastructure.repository.OtRepositoryAdapter;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Runtime harness for dispatch (tasks 6a.3/6a.4): real H2 persistence, the real
 * H2 spatial adapter and a fixed clock, no sleeps. Proves the initial broadcast
 * creates one pending 60-second offer per eligible technician, that escalation
 * expires the old offers and re-broadcasts at +5 km, and that the maximum radius
 * lands in the negative terminal state with an audited history entry.
 */
@DataJpaTest
@Import({IniciarBusquedaTecnicoUseCase.class, EscalarRadioUseCase.class,
        OtRepositoryAdapter.class, OtEstadoHistorialRepositoryAdapter.class,
        OfertaOtRepositoryAdapter.class, H2TecnicoDisponibilidadAdapter.class,
        LoggingNotificacionPushAdapter.class, DespachoOtIT.ClockDePrueba.class})
class DespachoOtIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Point BOGOTA = new Point(4.6, -74.0);

    @TestConfiguration
    static class ClockDePrueba {
        @Bean
        Clock fixedClock() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }
    }

    @Autowired IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    @Autowired EscalarRadioUseCase escalarRadio;
    @Autowired OtRepository otRepository;
    @Autowired OfertaOtRepository ofertaRepository;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataTecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @Test
    void initialSearchCreatesOnePendingSixtySecondOfferPerEligibleTechnician() {
        persistirTecnico(4.61, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        persistirTecnico(4.62, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        // Ineligible: outside the radius.
        persistirTecnico(5.0, -74.0, EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                Set.of(CategoriaServicio.REFRIGERACION));
        Ot ot = otSolicitada();

        Ot resultado = iniciarBusqueda.iniciar(ot);

        SoftAssertions.assertSoftly(softly -> {
            softly.assertThat(resultado.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
            softly.assertThat(resultado.getRadioKm()).isEqualTo(10.0);
            softly.assertThat(resultado.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(60));
            softly.assertThat(ofertaRepository.listarPendientesPorOt(resultado.getId())).hasSize(2);
        });
        List<OfertaOt> ofertas = ofertaRepository.listarPendientesPorOt(resultado.getId());
        assertThat(ofertas).isNotEmpty().allSatisfy(oferta -> {
            assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.PENDIENTE);
            assertThat(oferta.getRadioKm()).isEqualTo(10.0);
            assertThat(oferta.getExpiraEn()).isEqualTo(AHORA.plusSeconds(60));
        });
    }

    @Test
    void escalationExpiresTheOldOffersAndRebroadcastsAtTheNextRadius() {
        UUID cercanoEnQuince = persistirTecnico(4.708, -74.0, EstadoValidacion.APROBADO,
                EstadoOperativo.DISPONIBLE, Set.of(CategoriaServicio.REFRIGERACION)); // ~12 km
        Ot ot = otBuscandoVencida(10.0);
        OfertaOt ofertaVencida = ofertaRepository.save(OfertaOt.crear(ot.getId(), com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId.nueva(),
                10.0, AHORA.minusSeconds(60), AHORA));

        int procesadas = escalarRadio.ejecutar();

        assertThat(procesadas).isEqualTo(1);
        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
            assertThat(found.getRadioKm()).isEqualTo(15.0);
            assertThat(found.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(60));
        });
        assertThat(ofertaRepository.buscarPorId(ofertaVencida.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.EXPIRADA));
        assertThat(ofertaRepository.listarPendientesPorOt(ot.getId()))
                .singleElement()
                .satisfies(oferta -> {
                    assertThat(oferta.getTecnicoId().valor()).isEqualTo(cercanoEnQuince);
                    assertThat(oferta.getRadioKm()).isEqualTo(15.0);
                    assertThat(oferta.getExpiraEn()).isEqualTo(AHORA.plusSeconds(60));
                });
    }

    @Test
    void maximumRadiusWithoutAcceptanceReachesTheNegativeTerminalState() {
        Ot ot = otBuscandoVencida(25.0);

        escalarRadio.ejecutar();

        assertThat(otRepository.buscarPorId(ot.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES);
            assertThat(found.esTerminal()).isTrue();
        });
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor()))
                .extracting(com.sena.cold_day.core.modules.ot.infrastructure.persistence
                        .OtEstadoHistorialJpaEntity::getEstadoDestino)
                .containsExactly(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO,
                        EstadoOt.SIN_TECNICOS_DISPONIBLES);
    }

    private Ot otSolicitada() {
        return Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", BOGOTA, AHORA);
    }

    private Ot otBuscandoVencida(double radioKm) {
        Ot ot = otSolicitada();
        ot.iniciarBusqueda(radioKm, AHORA, ActorOt.CLIENTE, AHORA);
        return otRepository.save(ot);
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
