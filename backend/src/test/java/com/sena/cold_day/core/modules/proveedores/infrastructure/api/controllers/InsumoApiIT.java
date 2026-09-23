package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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

import com.sena.cold_day.core.modules.proveedores.application.usecases.AceptarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.EntregarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ExpirarInsumosUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
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
 * Integration proof of the insumo dispatch flows against the real H2 schema and
 * the slice-9 persistence (spec disp.R1/R3/R6/R7, design flow (b)).
 *
 * <p>The use-case subset exercises the application layer directly (broadcast,
 * atomic first-to-accept with sibling invalidation, delivery, the
 * inactive-supplier gate, zero eligible suppliers and the expiry sweep). The HTTP
 * subset added in slice 11 drives {@code InsumoController} end to end with
 * MockMvc and real JWTs: listing, accept, reject, deliver, the role boundary and
 * the canonical error statuses.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(InsumoApiIT.RelojFijo.class)
class InsumoApiIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
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

    @Autowired SolicitarInsumoUseCase solicitar;
    @Autowired AceptarInsumoUseCase aceptar;
    @Autowired EntregarInsumoUseCase entregar;
    @Autowired ExpirarInsumosUseCase expirar;
    @Autowired RequerimientoInsumoRepository requerimientos;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired ProveedorRepository proveedores;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;
    @Autowired SpringDataProveedorRepository springDataProveedores;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
        springDataProveedores.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void broadcastThenFirstAcceptThenDeliveryCompletesTheRequest() {
        Proveedor primero = crearProveedorActivo("900-1", "prov.1@example.com");
        Proveedor segundo = crearProveedorActivo("900-2", "prov.2@example.com");
        crearProveedorInactivo("900-3", "prov.3@example.com");

        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, "Compresor ruidoso").orElseThrow();
        assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);

        // AD7: only the two active suppliers receive an offer.
        List<OfertaInsumo> pendientes = ofertas.listarPendientesPorRequerimiento(req.getId());
        assertThat(pendientes).hasSize(2);

        OfertaInsumo dePrimero = ofertaDe(pendientes, primero.getId());
        RequerimientoInsumo asignado = aceptar.aceptar(new UsuarioId(primero.getUsuarioId()), dePrimero.getId());

        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        assertThat(ofertas.buscarPorId(dePrimero.getId())).hasValueSatisfying(
                oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.ACEPTADA));
        assertThat(ofertas.buscarPorId(ofertaDe(pendientes, segundo.getId()).getId())).hasValueSatisfying(
                oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));

        RequerimientoInsumo entregado = entregar.entregar(new UsuarioId(primero.getUsuarioId()), req.getId());
        assertThat(entregado.getEstado()).isEqualTo(EstadoRequerimiento.ENTREGADO);
        assertThat(entregado.getResueltaEn()).isEqualTo(AHORA);
    }

    @Test
    void anInactiveSupplierCannotAcceptAndLeavesTheRequestUntouched() {
        crearProveedorActivo("900-4", "prov.4@example.com");
        Proveedor inactivo = crearProveedorInactivo("900-5", "prov.5@example.com");

        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo delInactivo = ofertas.save(
                OfertaInsumo.crear(req.getId(), inactivo.getId(), AHORA, EXPIRA));

        assertThatThrownBy(() -> aceptar.aceptar(new UsuarioId(inactivo.getUsuarioId()), delInactivo.getId()))
                .isInstanceOf(ProveedorNoElegibleException.class);

        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
        assertThat(ofertas.buscarPorId(delInactivo.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE));
    }

    @Test
    void zeroEligibleSuppliersResolveToSinProveedorWithoutBlockingTheOt() {
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();

        assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
        assertThat(ofertas.listarPendientesPorRequerimiento(req.getId())).isEmpty();
        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR));
    }

    @Test
    void theExpirySweepClosesPendingOffersAndResolvesOpenRequests() {
        RequerimientoInsumo vencido = requerimientos.save(RequerimientoInsumo.crear(OT_ID, TECNICO_ID, LINEAS,
                null, AHORA.minusSeconds(10), AHORA.minusSeconds(1)));
        OfertaInsumo ofertaVencida = ofertas.save(OfertaInsumo.crear(vencido.getId(), ProveedorId.nueva(),
                AHORA.minusSeconds(10), AHORA.minusSeconds(1)));
        RequerimientoInsumo vigente = requerimientos.save(RequerimientoInsumo.crear(OT_ID, TECNICO_ID, LINEAS,
                null, AHORA, EXPIRA));
        ofertas.save(OfertaInsumo.crear(vigente.getId(), ProveedorId.nueva(), AHORA, EXPIRA));

        ExpirarInsumosUseCase.Resultado resultado = expirar.expirar();

        assertThat(resultado.ofertasExpiradas()).isEqualTo(1);
        assertThat(resultado.requerimientosSinProveedor()).isEqualTo(1);
        assertThat(ofertas.buscarPorId(ofertaVencida.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA));
        assertThat(requerimientos.buscarPorId(vencido.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR));
        assertThat(requerimientos.buscarPorId(vigente.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
    }

    // ------------------------------------------------------------------
    // HTTP subset (slice 11): InsumoController + InsumoControllerAdvice
    // ------------------------------------------------------------------

    @Test
    void supplierListsItsPendingSolicitudesOverHttp() throws Exception {
        Proveedor primero = crearProveedorActivo("901-1", "http.prov.1@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, "Compresor ruidoso").orElseThrow();

        mockMvc.perform(get("/api/proveedores/me/solicitudes")
                        .header("Authorization", bearer(jwt(primero))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE"))
                .andExpect(jsonPath("$[0].requerimiento.id").value(req.getId().valor().toString()))
                .andExpect(jsonPath("$[0].requerimiento.estado").value("SOLICITADO"))
                .andExpect(jsonPath("$[0].requerimiento.items[0].descripcion").value("Filtro secadora"))
                .andExpect(jsonPath("$[0].requerimiento.items[0].cantidad").value(2));

        // The supplier surface is closed to other roles and to anonymous callers.
        mockMvc.perform(get("/api/proveedores/me/solicitudes")
                        .header("Authorization", bearer(jwtDeRol(500L, Rol.TECNICO))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/proveedores/me/solicitudes"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void firstAcceptWinsOverHttpAndTheLoserGets409() throws Exception {
        Proveedor primero = crearProveedorActivo("901-2", "http.prov.2@example.com");
        Proveedor segundo = crearProveedorActivo("901-3", "http.prov.3@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo dePrimero = ofertaDe(ofertas.listarPendientesPorRequerimiento(req.getId()), primero.getId());
        OfertaInsumo deSegundo = ofertaDe(ofertas.listarPendientesPorRequerimiento(req.getId()), segundo.getId());

        mockMvc.perform(post("/api/insumos/" + dePrimero.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(primero))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ASIGNADO"));

        // disp.S3.2: the sibling offer lost the gate -> 409 and is invalidated.
        mockMvc.perform(post("/api/insumos/" + deSegundo.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(segundo))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(ofertas.buscarPorId(deSegundo.getId())).hasValueSatisfying(
                oferta -> assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));
    }

    @Test
    void supplierRejectsOverHttpAndIsNotBound() throws Exception {
        Proveedor primero = crearProveedorActivo("901-4", "http.prov.4@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo oferta = ofertaDe(ofertas.listarPendientesPorRequerimiento(req.getId()), primero.getId());

        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/rechazar")
                        .header("Authorization", bearer(jwt(primero))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("RECHAZADO"));

        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(
                found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
    }

    @Test
    void winningSupplierDeliversOverHttpAndAnotherSupplierIsForbidden() throws Exception {
        Proveedor primero = crearProveedorActivo("901-5", "http.prov.5@example.com");
        Proveedor segundo = crearProveedorActivo("901-6", "http.prov.6@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo dePrimero = ofertaDe(ofertas.listarPendientesPorRequerimiento(req.getId()), primero.getId());

        // disp.S7.1: a supplier that did not win the request cannot confirm delivery.
        mockMvc.perform(post("/api/insumos/" + req.getId().valor() + "/entregar")
                        .header("Authorization", bearer(jwt(segundo))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        mockMvc.perform(post("/api/insumos/" + dePrimero.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(primero))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/insumos/" + req.getId().valor() + "/entregar")
                        .header("Authorization", bearer(jwt(primero))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ENTREGADO"));
    }

    @Test
    void anUnlinkedSupplierIsForbiddenOverHttp() throws Exception {
        Proveedor activo = crearProveedorActivo("901-7", "http.prov.7@example.com");
        RequerimientoInsumo req = solicitar.solicitar(OT_ID, TECNICO_ID, LINEAS, null).orElseThrow();
        OfertaInsumo oferta = ofertaDe(ofertas.listarPendientesPorRequerimiento(req.getId()), activo.getId());
        Long huerfano = crearUsuario("http.prov.huerfano@example.com");

        // A PROVEEDOR account with no linked Proveedor cannot act (spec disp.R3, AD7).
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwtDeRol(huerfano, Rol.PROVEEDOR))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void anUnknownOfferIsAConflictAndAnUnknownRequestIsNotFound() throws Exception {
        Proveedor activo = crearProveedorActivo("901-8", "http.prov.8@example.com");

        mockMvc.perform(post("/api/insumos/" + UUID.randomUUID() + "/aceptar")
                        .header("Authorization", bearer(jwt(activo))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        mockMvc.perform(post("/api/insumos/" + UUID.randomUUID() + "/entregar")
                        .header("Authorization", bearer(jwt(activo))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void aMalformedOfferIdIsBadRequest() throws Exception {
        Proveedor activo = crearProveedorActivo("901-9", "http.prov.9@example.com");

        mockMvc.perform(post("/api/insumos/not-a-uuid/aceptar")
                        .header("Authorization", bearer(jwt(activo))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String jwt(Proveedor proveedor) {
        return jwtDeRol(proveedor.getUsuarioId(), Rol.PROVEEDOR);
    }

    private String jwtDeRol(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }

    private Proveedor crearProveedorActivo(String nit, String correo) {
        return proveedores.save(Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of()));
    }

    private Proveedor crearProveedorInactivo(String nit, String correo) {
        Proveedor proveedor = Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of());
        proveedor.desactivar();
        return proveedores.save(proveedor);
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

    private OfertaInsumo ofertaDe(List<OfertaInsumo> pendientes, ProveedorId proveedorId) {
        return pendientes.stream().filter(oferta -> oferta.getProveedorId().equals(proveedorId)).findFirst()
                .orElseThrow();
    }
}
