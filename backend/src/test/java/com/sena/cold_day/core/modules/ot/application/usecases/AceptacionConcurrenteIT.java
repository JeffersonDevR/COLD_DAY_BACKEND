package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaNoDisponibleException;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Authoritative proof of the exactly-one-winner invariant (task 6b.6, RNF-07).
 * Two offers of the same OT are accepted by two threads released together by a
 * {@link CountDownLatch}: exactly one offer becomes {@code ACEPTADA}, the OT is
 * {@code ASIGNADA} to that technician, the loser receives a domain conflict and
 * its own offer is invalidated. A fixed clock removes any timing dependency (no
 * sleeps); the escalation sweep is pushed out of the way.
 */
@SpringBootTest
@TestPropertySource(properties = "app.dispatch.escalamiento-ms=3600000")
@Import(AceptacionConcurrenteIT.RelojFijo.class)
class AceptacionConcurrenteIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Point BOGOTA = new Point(4.6, -74.0);

    @TestConfiguration
    static class RelojFijo {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }
    }

    @Autowired AceptarOfertaUseCase aceptarOferta;
    @Autowired IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    @Autowired OtRepository otRepository;
    @Autowired OfertaOtRepository ofertaRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void twoSimultaneousAcceptsResolveToExactlyOneAssignment() throws Exception {
        Tecnico primero = crearTecnicoDisponible(4.61);
        Tecnico segundo = crearTecnicoDisponible(4.62);
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", BOGOTA, AHORA);
        Ot buscando = iniciarBusqueda.iniciar(ot);

        List<OfertaOt> ofertas = ofertaRepository.listarPendientesPorOt(buscando.getId());
        assertThat(ofertas).hasSize(2);
        OfertaOt ofertaPrimero = ofertaDe(ofertas, primero.getId());
        OfertaOt ofertaSegundo = ofertaDe(ofertas, segundo.getId());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch listos = new CountDownLatch(2);
        CountDownLatch disparar = new CountDownLatch(1);
        try {
            Future<Object> corridaPrimero = pool.submit(
                    () -> aceptarCuandoSuene(new UsuarioId(primero.getUsuarioId()), ofertaPrimero.getId(),
                            listos, disparar));
            Future<Object> corridaSegundo = pool.submit(
                    () -> aceptarCuandoSuene(new UsuarioId(segundo.getUsuarioId()), ofertaSegundo.getId(),
                            listos, disparar));
            assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
            disparar.countDown();
            Object resultadoPrimero = corridaPrimero.get(15, TimeUnit.SECONDS);
            Object resultadoSegundo = corridaSegundo.get(15, TimeUnit.SECONDS);

            long ganadores = java.util.stream.Stream.of(resultadoPrimero, resultadoSegundo)
                    .filter(resultado -> resultado instanceof OtResponse).count();
            long conflictos = java.util.stream.Stream.of(resultadoPrimero, resultadoSegundo)
                    .filter(resultado -> resultado instanceof OfertaNoDisponibleException).count();
            assertThat(ganadores).isEqualTo(1);
            assertThat(conflictos).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        Ot asignada = otRepository.buscarPorId(buscando.getId()).orElseThrow();
        assertThat(asignada.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
        TecnicoId ganador = asignada.getTecnicoId();
        TecnicoId perdedor = ganador.equals(primero.getId()) ? segundo.getId() : primero.getId();

        assertThat(ofertaRepository.buscarPorId(ofertaDe(ofertas, ganador).getId()))
                .hasValueSatisfying(oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.ACEPTADA));
        assertThat(ofertaRepository.buscarPorId(ofertaDe(ofertas, perdedor).getId()))
                .hasValueSatisfying(oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.CANCELADA));
        assertThat(tecnicoRepository.findByIdAndActivoTrue(ganador))
                .hasValueSatisfying(tecnico -> assertThat(tecnico.getEstadoOperativo())
                        .isEqualTo(EstadoOperativo.OCUPADO));
        assertThat(tecnicoRepository.findByIdAndActivoTrue(perdedor))
                .hasValueSatisfying(tecnico -> assertThat(tecnico.getEstadoOperativo())
                        .isEqualTo(EstadoOperativo.DISPONIBLE));
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(buscando.getId().valor()))
                .last()
                .satisfies(entrada -> {
                    assertThat(entrada.getEstadoOrigen()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
                    assertThat(entrada.getEstadoDestino()).isEqualTo(EstadoOt.ASIGNADA);
                    assertThat(entrada.getActor()).isEqualTo(ActorOt.TECNICO);
                });
    }

    /** Releases both threads together, then returns the response or the thrown domain error. */
    private Object aceptarCuandoSuene(UsuarioId usuarioId, com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId ofertaId,
            CountDownLatch listos, CountDownLatch disparar) throws InterruptedException {
        listos.countDown();
        disparar.await(10, TimeUnit.SECONDS);
        try {
            return aceptarOferta.aceptar(usuarioId, ofertaId);
        } catch (RuntimeException fallo) {
            return fallo;
        }
    }

    private OfertaOt ofertaDe(List<OfertaOt> ofertas, TecnicoId tecnicoId) {
        return ofertas.stream().filter(oferta -> oferta.getTecnicoId().equals(tecnicoId)).findFirst().orElseThrow();
    }

    private Tecnico crearTecnicoDisponible(double latitud) {
        Long usuarioId = crearUsuario();
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.actualizarUbicacion(new Point(latitud, BOGOTA.longitud()), AHORA);
        return tecnicoRepository.save(tecnico);
    }

    private Long crearUsuario() {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", UUID.randomUUID() + "@example.com", "secreto", null, null,
                Rol.TECNICO, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }
}
