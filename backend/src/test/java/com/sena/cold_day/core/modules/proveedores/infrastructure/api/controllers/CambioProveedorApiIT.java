package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.proveedores.application.usecases.AceptarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.CambiarProveedorInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.DespacharInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataOfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataRequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;
import com.sena.cold_day.support.FkFixtures;

/** El tecnico cambia de proveedor cuando vence el ETA: HTTP, roles y la carrera contra el despacho. */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(CambioProveedorApiIT.RelojFijo.class)
class CambioProveedorApiIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Point DESTINO = new Point(4.6097, -74.0817);
    private static final Point CERCA = new Point(4.6277, -74.0817);
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

    @TestConfiguration
    static class RelojFijo {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }
    }

    @Autowired SolicitarInsumoUseCase solicitar;
    @Autowired AceptarInsumoUseCase aceptar;
    @Autowired DespacharInsumoUseCase despachar;
    @Autowired CambiarProveedorInsumoUseCase cambiar;
    @Autowired RequerimientoInsumoRepository requerimientos;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired ProveedorRepository proveedores;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;
    @Autowired SpringDataProveedorRepository springDataProveedores;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired JdbcTemplate jdbc;

    private FkFixtures fx;
    private UUID otId;
    private UUID tecnicoId;

    @BeforeEach
    void preparar() {
        limpiar();
        fx = new FkFixtures(jdbc);
        otId = fx.ot(UUID.randomUUID());
        // El cambio de proveedor lee la OT: sin radio no se puede cargar (la app siempre lo escribe).
        jdbc.update("UPDATE ot SET radio_km = 10 WHERE id = ?", otId);
        tecnicoId = fx.tecnico(UUID.randomUUID());
    }

    @AfterEach
    void limpiar() {
        jdbc.update("DELETE FROM incumplimiento_insumo");
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
        springDataProveedores.deleteAll();
        new FkFixtures(jdbc).limpiarPadres();
        usuarioRepository.deleteAll();
    }

    @Test
    void antesDeVencerEs409YNadaCambia() throws Exception {
        Proveedor a = proveedor("910-1");
        RequerimientoInsumo req = aceptadoPor(a, 30, 29);

        mockMvc.perform(post(ruta(req)).header("Authorization", tecnico(tecnicoId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Todavía no vence el tiempo prometido"));

        assertThat(estado(req)).isEqualTo(EstadoRequerimiento.ASIGNADO);
    }

    @Test
    void vencidoSeReabreElAnteriorLoPierdeYElAdminVeElIncumplimiento() throws Exception {
        Proveedor a = proveedor("910-2");
        Proveedor b = proveedor("910-3");
        RequerimientoInsumo req = aceptadoPor(a, 30, 31);

        mockMvc.perform(post(ruta(req)).header("Authorization", tecnico(tecnicoId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("SOLICITADO"))
                .andExpect(jsonPath("$.etaMinutos").doesNotExist());

        mockMvc.perform(get("/api/proveedores/me/solicitudes").header("Authorization", bearer(a)))
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/proveedores/me/solicitudes").header("Authorization", bearer(b)))
                .andExpect(jsonPath("$.length()").value(1));

        // Even after another supplier takes it, the replaced one cannot act on it.
        aceptarComo(b, req, 20);
        mockMvc.perform(post("/api/insumos/" + id(req) + "/despachar").header("Authorization", bearer(a)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Este pedido ya no es tuyo"));
        mockMvc.perform(get("/api/proveedores/me/solicitudes").header("Authorization", bearer(a)))
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/proveedores/incumplimientos")
                        .header("Authorization", token(fx.usuario("ADMINISTRADOR"), Rol.ADMINISTRADOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].proveedorId").value(a.getId().valor().toString()))
                .andExpect(jsonPath("$[0].razonSocial").value("Suministros 910-2"))
                .andExpect(jsonPath("$[0].requerimientoId").value(id(req)))
                .andExpect(jsonPath("$[0].etaMinutos").value(30));
        mockMvc.perform(get("/api/proveedores/incumplimientos").header("Authorization", tecnico(tecnicoId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void enUnaOrdenCanceladaEs409() throws Exception {
        Proveedor a = proveedor("910-6");
        RequerimientoInsumo req = aceptadoPor(a, 30, 31);
        jdbc.update("UPDATE ot SET estado = 'CANCELADA' WHERE id = ?", otId);

        mockMvc.perform(post(ruta(req)).header("Authorization", tecnico(tecnicoId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("La orden de trabajo ya está cerrada"));

        assertThat(estado(req)).isEqualTo(EstadoRequerimiento.ASIGNADO);
    }

    @Test
    void otroTecnicoRecibe404YUnProveedor403() throws Exception {
        Proveedor a = proveedor("910-4");
        RequerimientoInsumo req = aceptadoPor(a, 30, 31);

        mockMvc.perform(post(ruta(req)).header("Authorization", tecnico(fx.tecnico(UUID.randomUUID()))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(ruta(req)).header("Authorization", bearer(a)))
                .andExpect(status().isForbidden());

        assertThat(estado(req)).isEqualTo(EstadoRequerimiento.ASIGNADO);
    }

    @Test
    void carreraDespacharContraCambiarExactamenteUnoGana() throws Exception {
        Proveedor a = proveedor("910-5");
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            for (int vuelta = 0; vuelta < 5; vuelta++) {
                RequerimientoInsumo req = aceptadoPor(a, 30, 31);
                CountDownLatch salida = new CountDownLatch(1);
                Future<Boolean> despacho = hilos.submit(gana(salida,
                        () -> despachar.despachar(new UsuarioId(a.getUsuarioId()), req.getId())));
                Future<Boolean> cambio = hilos.submit(gana(salida, () -> cambiar.cambiar(req.getId(), tecnicoId)));
                salida.countDown();

                assertThat(despacho.get()).isNotEqualTo(cambio.get());
                assertThat(estado(req)).isEqualTo(
                        despacho.get() ? EstadoRequerimiento.DESPACHADO : EstadoRequerimiento.SOLICITADO);
            }
        } finally {
            hilos.shutdownNow();
        }
    }

    private static Callable<Boolean> gana(CountDownLatch salida, Runnable accion) {
        return () -> {
            salida.await();
            try {
                accion.run();
                return true;
            } catch (RuntimeException perdedor) {
                return false;
            }
        };
    }

    /** Pedido aceptado por {@code proveedor} hace {@code haceMinutos} con el ETA indicado. */
    private RequerimientoInsumo aceptadoPor(Proveedor proveedor, int eta, int haceMinutos) {
        RequerimientoInsumo req = solicitar.solicitar(otId, tecnicoId, DESTINO, LINEAS, null).orElseThrow();
        aceptarComo(proveedor, req, eta);
        jdbc.update("UPDATE requerimiento_insumo SET aceptada_en = ? WHERE id = ?",
                java.sql.Timestamp.from(AHORA.minus(haceMinutos, ChronoUnit.MINUTES)), req.getId().valor());
        return req;
    }

    private void aceptarComo(Proveedor proveedor, RequerimientoInsumo req, int eta) {
        OfertaInsumo oferta = ofertas.listarPendientesPorRequerimiento(req.getId()).stream()
                .filter(o -> o.getProveedorId().equals(proveedor.getId())).findFirst().orElseThrow();
        aceptar.aceptar(new UsuarioId(proveedor.getUsuarioId()), oferta.getId(), eta);
    }

    private Proveedor proveedor(String nit) {
        Proveedor proveedor = Proveedor.crear(fx.usuario("PROVEEDOR"), "Suministros " + nit, nit, "3105550001",
                null, CERCA, Set.of());
        proveedor.aprobarValidacion(LocalDate.of(2026, 1, 1),
                List.of(new DocumentoProveedor(1L, proveedor.getId(), "RUT", LocalDate.of(2027, 1, 1))));
        return proveedores.save(proveedor);
    }

    private EstadoRequerimiento estado(RequerimientoInsumo req) {
        return requerimientos.buscarPorId(req.getId()).orElseThrow().getEstado();
    }

    private static String id(RequerimientoInsumo req) {
        return req.getId().valor().toString();
    }

    private static String ruta(RequerimientoInsumo req) {
        return "/api/insumos/" + id(req) + "/cambiar-proveedor";
    }

    private String bearer(Proveedor proveedor) {
        return token(proveedor.getUsuarioId(), Rol.PROVEEDOR);
    }

    private String tecnico(UUID id) {
        Long usuarioId = jdbc.queryForObject("SELECT usuario_id FROM tecnico WHERE id = ?", Long.class, id);
        return token(usuarioId, Rol.TECNICO);
    }

    private String token(Long usuarioId, Rol rol) {
        return "Bearer " + tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
