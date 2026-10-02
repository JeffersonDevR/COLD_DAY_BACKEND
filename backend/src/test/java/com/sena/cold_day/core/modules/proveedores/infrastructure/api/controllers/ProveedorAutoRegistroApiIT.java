package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;
import com.sena.cold_day.support.FkFixtures;

/**
 * The regression that matters after opening {@code POST /api/proveedores}:
 * self-registration must not have weakened anything V8 built.
 *
 * <p>V8 exists because a supplier could take insumo orders "without anyone ever
 * validating their documentation". Before this change only an administrator
 * could create a supplier, so the population was small and trusted by
 * construction. Self-registration turns that into an open door, and the only
 * thing standing between a stranger and an insumo order is the
 * {@code exigirValidado()} gate. So these tests assert the whole chain end to
 * end, over HTTP, from a genuinely anonymous caller:
 *
 * <ol>
 * <li>an anonymous caller registers and gets 201 with the expected body;</li>
 * <li>the supplier it created is {@code PENDIENTE} — asserted in the response,
 * in the aggregate and after a round trip through the database, because V8
 * dropped the column default;</li>
 * <li>a {@code rol} in the body cannot escalate the account;</li>
 * <li>the new supplier cannot accept an insumo, and can only after an
 * administrator approves it.</li>
 * </ol>
 *
 * <p>Point 4 is the one that would catch a future "just auto-approve on
 * registration" shortcut: it re-runs the exact scenario V8 was written for.
 *
 * <p>The clock is fixed so document expiry is deterministic instead of
 * dependent on the day the suite runs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(ProveedorAutoRegistroApiIT.RelojFijo.class)
class ProveedorAutoRegistroApiIT {

    @Autowired
    void inyectarFixtures(JdbcTemplate jdbc) {
        fx = new FkFixtures(jdbc);
    }

    FkFixtures fx;

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final LocalDate VIGENTE = LocalDate.of(2027, 1, 1);
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
    @Autowired ProveedorRepository proveedores;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired SolicitarInsumoUseCase solicitar;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    // ------------------------------------------------------------------
    // 1. An anonymous caller can register, and gets the expected response.
    // ------------------------------------------------------------------

    @Test
    void anAnonymousCallerRegistersASupplierAndGetsTheExpectedResponse() throws Exception {
        // No Authorization header at all: the endpoint is permitAll, exactly like
        // POST /api/clientes and POST /api/tecnicos.
        mockMvc.perform(post("/api/proveedores").contentType(MediaType.APPLICATION_JSON)
                .content(payload("AUTO-1", "auto.1@example.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.usuarioId").isNumber())
                .andExpect(jsonPath("$.razonSocial").value("Suministros del Norte"))
                .andExpect(jsonPath("$.nit").value("AUTO-1"))
                .andExpect(jsonPath("$.telefono").value("3105550001"))
                .andExpect(jsonPath("$.activo").value(true))
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"))
                // Credentials are never echoed back on the public path either.
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        // The account really exists and is usable: it logs in as a supplier.
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"auto.1@example.com\",\"password\":\"secreto123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("PROVEEDOR"));
    }

    // ------------------------------------------------------------------
    // 2. The supplier is born PENDIENTE, in the domain and in the database.
    // ------------------------------------------------------------------

    @Test
    void theSelfRegisteredSupplierIsPendingEverywhereAndIsNotVisibleToOtherRoles() throws Exception {
        mockMvc.perform(post("/api/proveedores").contentType(MediaType.APPLICATION_JSON)
                .content(payload("AUTO-2", "auto.2@example.com")))
                .andExpect(status().isCreated());

        UsuarioJpaEntity usuario = usuarioRepository.findByCorreo("auto.2@example.com").orElseThrow();
        Proveedor persistido = proveedores.findByUsuarioId(usuario.getId()).orElseThrow();

        // V8 dropped the DEFAULT on proveedor.estado_validacion, so the column is
        // only satisfied because Proveedor.crear states PENDIENTE explicitly.
        assertThat(persistido.getEstadoValidacion()).isEqualTo(EstadoValidacionProveedor.PENDIENTE);
        assertThat(proveedores.buscarPorId(persistido.getId())).get()
                .extracting(Proveedor::getEstadoValidacion).isEqualTo(EstadoValidacionProveedor.PENDIENTE);

        // Being public did NOT make the roster public.
        mockMvc.perform(get("/api/proveedores")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/proveedores")
                .header("Authorization", bearer(jwtDeRol(usuario.getId(), Rol.PROVEEDOR))))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------
    // 3. A client-supplied role cannot escalate the account.
    // ------------------------------------------------------------------

    @Test
    void aClientSuppliedRoleIsDroppedAndTheAccountIsAlwaysCreatedAsProveedor() throws Exception {
        // "rol":"ADMINISTRADOR" is sent on purpose. ProveedorApiRequest declares no
        // such component, so Jackson treats it as an unknown property and drops
        // it: ProveedorApiRequest cannot express the field, so it cannot be
        // honoured. Same closure UsuariosApiIT proves for POST /api/usuarios.
        mockMvc.perform(post("/api/proveedores").contentType(MediaType.APPLICATION_JSON)
                .content(payloadConRol("AUTO-3", "auto.3@example.com", "ADMINISTRADOR")))
                .andExpect(status().isCreated());

        UsuarioJpaEntity usuario = usuarioRepository.findByCorreo("auto.3@example.com").orElseThrow();
        assertThat(usuario.getRol())
                .as("el rol lo deriva el servidor; uno en el cuerpo no escala privilegios")
                .isEqualTo(Rol.PROVEEDOR);

        // The escalation does not even survive a login.
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"auto.3@example.com\",\"password\":\"secreto123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("PROVEEDOR"));

        // And every administrator surface stays closed to the "promoted" account.
        String token = login("auto.3@example.com");
        for (String ruta : List.of("/api/proveedores", "/api/usuarios", "/api/admin/metricas")) {
            mockMvc.perform(get(ruta).header("Authorization", bearer(token)))
                    .andExpect(status().isForbidden());
        }
    }

    // ------------------------------------------------------------------
    // 4. The gate survives: pending cannot accept, approved can.
    // ------------------------------------------------------------------

    @Test
    void aSelfRegisteredPendingSupplierCannotAcceptAnInsumoAndCanOnlyAfterAnAdminApproves() throws Exception {
        mockMvc.perform(post("/api/proveedores").contentType(MediaType.APPLICATION_JSON)
                .content(payload("AUTO-4", "auto.4@example.com")))
                .andExpect(status().isCreated());

        UsuarioJpaEntity usuario = usuarioRepository.findByCorreo("auto.4@example.com").orElseThrow();
        Proveedor proveedor = proveedores.findByUsuarioId(usuario.getId()).orElseThrow();
        String token = login("auto.4@example.com");

        // A live offer, produced by a real broadcast to every active supplier.
        OfertaInsumo oferta = ofertaPara(proveedor);

        // The supplier is active and holds a live offer, and is still refused: the
        // blocker is the validation gate, not eligibility.
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        // A supplier cannot approve itself; only an administrator can move it out
        // of PENDIENTE. Nothing in self-registration changed that.
        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isForbidden());

        // An approval with no documentation is still a 400, not a shortcut.
        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                .header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/proveedores/me/documentos")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(documento("RUT", VIGENTE)))
                .andExpect(status().isCreated());
        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                .header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNoContent());

        // Same supplier, same offer, now accepted: self-registration produced a
        // fully functional supplier the moment the gate was satisfied.
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ASIGNADO"));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** A live offer for {@code proveedor}, produced by a real broadcast. */
    private OfertaInsumo ofertaPara(Proveedor proveedor) {
        RequerimientoInsumo requerimiento = solicitar
                .solicitar(fx.ot(UUID.randomUUID()), fx.tecnico(UUID.randomUUID()), LINEAS, "Filtro secadora")
                .orElseThrow();
        return ofertas.listarPendientesPorRequerimiento(requerimiento.getId()).stream()
                .filter(oferta -> oferta.getProveedorId().equals(proveedor.getId())).findFirst().orElseThrow();
    }

    private String login(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"%s\",\"password\":\"secreto123\"}".formatted(correo)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    private String documento(String tipo, LocalDate fechaVencimiento) {
        return "{\"tipo\":\"%s\",\"fechaVencimiento\":\"%s\"}".formatted(tipo, fechaVencimiento);
    }

    private String payload(String nit, String correo) {
        return ("{\"nombre\":\"Ana Proveedor\",\"correo\":\"%s\",\"password\":\"secreto123\","
                + "\"telefono\":\"3105550001\",\"razonSocial\":\"Suministros del Norte\",\"nit\":\"%s\","
                + "\"aceptaHabeasData\":true}")
                .formatted(correo, nit);
    }

    /** Same payload plus a {@code rol} the endpoint does not declare. */
    private String payloadConRol(String nit, String correo, String rol) {
        return ("{\"nombre\":\"Ana Proveedor\",\"correo\":\"%s\",\"password\":\"secreto123\","
                + "\"telefono\":\"3105550001\",\"razonSocial\":\"Suministros del Norte\",\"nit\":\"%s\","
                + "\"aceptaHabeasData\":true,\"rol\":\"%s\"}")
                .formatted(correo, nit, rol);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String jwtDeRol(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }

    private String adminJwt() {
        return jwtDeRol(999L, Rol.ADMINISTRADOR);
    }
}
