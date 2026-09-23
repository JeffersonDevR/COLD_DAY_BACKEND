package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.time.Instant;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataOfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataRequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * Authoritative HTTP proof of the exactly-one-winner invariant for insumo
 * dispatch (spec disp.S3.2, design AD6). Two suppliers POST the accept endpoint
 * from two threads released together by a {@link CountDownLatch}: the conditional
 * bulk UPDATE on the request root must let exactly one reach a 200 while the
 * other receives a 409, with the winner's offer {@code ACEPTADA} and the sibling
 * {@code CANCELADA}. A fixed clock removes any timing dependency (no sleeps) and
 * the sweeper is pushed out of the way.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(AceptacionInsumoConcurrenteIT.RelojFijo.class)
class AceptacionInsumoConcurrenteIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

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
    @Autowired SolicitarInsumoUseCase solicitar;
    @Autowired RequerimientoInsumoRepository requerimientos;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired ProveedorRepository proveedores;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;
    @Autowired SpringDataProveedorRepository springDataProveedores;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
        springDataProveedores.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void twoSimultaneousHttpAcceptsResolveToExactlyOneWinner() throws Exception {
        Proveedor primero = crearProveedorActivo("910-1", "conc.prov.1@example.com");
        Proveedor segundo = crearProveedorActivo("910-2", "conc.prov.2@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo dePrimero = ofertaDe(req, primero.getId());
        OfertaInsumo deSegundo = ofertaDe(req, segundo.getId());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch listos = new CountDownLatch(2);
        CountDownLatch disparar = new CountDownLatch(1);
        try {
            Future<Integer> corridaPrimero = pool.submit(
                    () -> aceptarCuandoSuene(jwt(primero), dePrimero, listos, disparar));
            Future<Integer> corridaSegundo = pool.submit(
                    () -> aceptarCuandoSuene(jwt(segundo), deSegundo, listos, disparar));
            assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
            disparar.countDown();
            int estadoPrimero = corridaPrimero.get(15, TimeUnit.SECONDS);
            int estadoSegundo = corridaSegundo.get(15, TimeUnit.SECONDS);

            long ganadores = java.util.stream.Stream.of(estadoPrimero, estadoSegundo)
                    .filter(estado -> estado == 200).count();
            long conflictos = java.util.stream.Stream.of(estadoPrimero, estadoSegundo)
                    .filter(estado -> estado == 409).count();
            assertThat(ganadores).isEqualTo(1);
            assertThat(conflictos).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO));

        long aceptadas = contarEstado(dePrimero, deSegundo, OfertaInsumoEstado.ACEPTADA);
        long canceladas = contarEstado(dePrimero, deSegundo, OfertaInsumoEstado.CANCELADA);
        assertThat(aceptadas).isEqualTo(1);
        assertThat(canceladas).isEqualTo(1);
    }

    /** Releases both threads together, then returns the observed HTTP status. */
    private int aceptarCuandoSuene(String token, OfertaInsumo oferta, CountDownLatch listos,
            CountDownLatch disparar) throws Exception {
        listos.countDown();
        disparar.await(10, TimeUnit.SECONDS);
        return mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getStatus();
    }

    private long contarEstado(OfertaInsumo primero, OfertaInsumo segundo, OfertaInsumoEstado estado) {
        return java.util.stream.Stream.of(primero, segundo)
                .map(oferta -> ofertas.buscarPorId(oferta.getId()).orElseThrow())
                .filter(oferta -> oferta.getEstado() == estado)
                .count();
    }

    private OfertaInsumo ofertaDe(RequerimientoInsumo req, ProveedorId proveedorId) {
        return ofertas.listarPendientesPorRequerimiento(req.getId()).stream()
                .filter(oferta -> oferta.getProveedorId().equals(proveedorId))
                .findFirst()
                .orElseThrow();
    }

    private Proveedor crearProveedorActivo(String nit, String correo) {
        return proveedores.save(Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of()));
    }

    private Long crearUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String password) {
                return "fake:" + password;
            }

            public boolean matches(String password, String hash) {
                return ("fake:" + password).equals(hash);
            }
        };
        Usuario usuario = Usuario.registrar("Proveedor", correo, "secreto", null, null, Rol.PROVEEDOR, true,
                encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Proveedor proveedor) {
        return tokenIssuer.emitir(new UsuarioId(proveedor.getUsuarioId()), Rol.PROVEEDOR, 0).valor();
    }
}
