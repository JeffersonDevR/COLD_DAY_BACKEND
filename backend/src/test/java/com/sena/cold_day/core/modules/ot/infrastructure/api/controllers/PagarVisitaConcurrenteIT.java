package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * HTTP-level proof of the deterministic conflict on concurrent visit payments
 * (task H2): two simultaneous {@code POST /api/ot/{id}/pagar-visita} requests
 * authenticated as the owning client resolve to exactly one 200 and one 409,
 * never a 500, and persist a single charge.
 *
 * <p>Why the loser is a 409 and not a 500: both requests read the same OT at
 * version N. The {@code @Version} column on {@code OtJpaEntity} lets only one
 * {@code UPDATE ... WHERE version = N} succeed; the loser's flush raises
 * {@code ObjectOptimisticLockingFailureException} (or the JPA
 * {@code OptimisticLockException}), which {@code GlobalControllerAdvice} maps
 * to 409. If the loser instead reads the OT after the winner commits,
 * {@code registrarPagoVisita}'s double-charge guard raises
 * {@code PagoVisitaInvalidoException}, also mapped to 409 by
 * {@code OtControllerAdvice}. Neither path is an unhandled 500.
 *
 * <p>Follows the executor/latch discipline of {@code AceptacionConcurrenteIT}
 * and {@code AceptacionInsumoConcurrenteIT}; the OT fixture mirrors
 * {@code OtVisitaCalificacionIT}. A fixed clock and a pushed-out escalation
 * sweep remove timing dependencies (no sleeps).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.dispatch.escalamiento-ms=3600000",
        "app.maps.enabled=false",
})
@Import(PagarVisitaConcurrenteIT.RelojFijo.class)
class PagarVisitaConcurrenteIT {

    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);
    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final String MEDIO_PAGO = "NEQUI";
    /** The minimum concurrency that actually exercises the version race. */
    private static final int PETICIONES_CONCURRENTES = 2;

    @TestConfiguration
    static class RelojFijo {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired OtRepository otRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void twoSimultaneousVisitPaymentsResolveToExactlyOneCharge() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-pago-concurrente@example.com");
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnSolicitada(cliente.getId());
        String token = jwt(clienteUsuario);

        ExecutorService pool = Executors.newFixedThreadPool(PETICIONES_CONCURRENTES);
        CountDownLatch listos = new CountDownLatch(PETICIONES_CONCURRENTES);
        CountDownLatch disparar = new CountDownLatch(1);
        List<Integer> estados = new ArrayList<>();
        try {
            List<Future<Integer>> corridas = new ArrayList<>();
            for (int i = 0; i < PETICIONES_CONCURRENTES; i++) {
                corridas.add(pool.submit(
                        () -> pagarCuandoSuene(token, ot.getId().valor(), listos, disparar)));
            }
            assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
            disparar.countDown();
            for (Future<Integer> corrida : corridas) {
                estados.add(corrida.get(15, TimeUnit.SECONDS));
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(estados).filteredOn(estado -> estado == 200).hasSize(1);
        assertThat(estados).filteredOn(estado -> estado == 409)
                .as("the loser is a deterministic 409, observed %s", estados)
                .hasSize(PETICIONES_CONCURRENTES - 1);
        assertThat(estados).doesNotContain(500);

        Ot pagada = otRepository.buscarPorId(ot.getId()).orElseThrow();
        assertThat(pagada.getVisitaPagadaEn()).isNotNull();
        assertThat(pagada.getMedioPagoVisita()).isEqualTo(MEDIO_PAGO);
        assertThat(pagada.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        // Exactly one accepted transition means exactly one charge took effect:
        // the loser's whole transaction (aggregate update and history) rolled back.
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor())).hasSize(1);
    }

    /** Releases both threads together, then returns the observed HTTP status. */
    private int pagarCuandoSuene(String token, UUID otId, CountDownLatch listos, CountDownLatch disparar)
            throws Exception {
        listos.countDown();
        disparar.await(10, TimeUnit.SECONDS);
        return mockMvc.perform(post("/api/ot/" + otId + "/pagar-visita")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"medioPago\":\"" + MEDIO_PAGO + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private Ot otEnSolicitada(ClienteId clienteId) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, null, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, EstadoOt.SOLICITADA, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(), null, null, null, null, null,
                null);
        return otRepository.save(ot);
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, Rol.CLIENTE, true,
                encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), Rol.CLIENTE, 0).valor();
    }
}
