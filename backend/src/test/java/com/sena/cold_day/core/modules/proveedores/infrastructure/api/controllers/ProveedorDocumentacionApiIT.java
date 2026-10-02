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
import java.util.Set;
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
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;
import com.sena.cold_day.support.FkFixtures;

/**
 * Integration proof of the supplier documentation surface and, above all, of the
 * validation gate it feeds (spec disp.R3, design AD7).
 *
 * <p>Before this slice {@code GestionarDocumentacionProveedorUseCase} had no HTTP
 * surface at all: a supplier could be created and could receive insumo offers, but
 * nothing could ever move it out of {@code PENDIENTE}, so every accept, reject and
 * delivery was refused by {@code Proveedor.exigirValidado()}. The last test is the
 * regression that matters: a {@code PENDIENTE} supplier is refused an insumo,
 * an administrator approves it, and the very same supplier then accepts.
 *
 * <p>The clock is fixed so document expiry is deterministic instead of dependent
 * on the day the suite runs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
@Import(ProveedorDocumentacionApiIT.RelojFijo.class)
class ProveedorDocumentacionApiIT {

    @Autowired
    void inyectarFixtures(JdbcTemplate jdbc) {
        fx = new FkFixtures(jdbc);
    }

    FkFixtures fx;

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final LocalDate VIGENTE = LocalDate.of(2027, 1, 1);
    private static final LocalDate VENCIDO = LocalDate.of(2026, 1, 1);
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
    // 1. A supplier registers and lists its own documents.
    // ------------------------------------------------------------------

    @Test
    void supplierRegistersAndListsItsOwnDocuments() throws Exception {
        Proveedor proveedor = crearProveedor("DOC-1", "doc.1@example.com");

        mockMvc.perform(post("/api/proveedores/me/documentos")
                        .header("Authorization", bearer(jwt(proveedor)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(documento("RUT", VIGENTE.toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.tipo").value("RUT"))
                .andExpect(jsonPath("$.fechaVencimiento").value(VIGENTE.toString()));

        mockMvc.perform(get("/api/proveedores/me/documentos")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tipo").value("RUT"))
                .andExpect(jsonPath("$[0].fechaVencimiento").value(VIGENTE.toString()));

        // A document is a metadata-only declaration: there is no file field on the wire.
        mockMvc.perform(get("/api/proveedores/me/documentos")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(jsonPath("$[0].archivoUrl").doesNotExist())
                .andExpect(jsonPath("$[0].nombre").doesNotExist());
    }

    @Test
    void theOwnDocumentsSurfaceIsClosedToOtherRolesAndToAnonymous() throws Exception {
        Proveedor proveedor = crearProveedor("DOC-2", "doc.2@example.com");

        for (String token : new String[] { jwtDeRol(501L, Rol.ADMINISTRADOR), jwtDeRol(502L, Rol.TECNICO),
                jwtDeRol(503L, Rol.CLIENTE) }) {
            mockMvc.perform(get("/api/proveedores/me/documentos").header("Authorization", bearer(token)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/proveedores/me/documentos").header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON).content(documento("RUT", VIGENTE.toString())))
                    .andExpect(status().isForbidden());
        }

        mockMvc.perform(get("/api/proveedores/me/documentos")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/proveedores/me/documentos").contentType(MediaType.APPLICATION_JSON)
                .content(documento("RUT", VIGENTE.toString()))).andExpect(status().isUnauthorized());
    }

    @Test
    void registeringADocumentWithoutATypeIsBadRequest() throws Exception {
        Proveedor proveedor = crearProveedor("DOC-3", "doc.3@example.com");

        mockMvc.perform(post("/api/proveedores/me/documentos")
                        .header("Authorization", bearer(jwt(proveedor)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipo\":\"\",\"fechaVencimiento\":\"" + VIGENTE + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());
    }

    // ------------------------------------------------------------------
    // 2. A supplier cannot touch another supplier's documentation.
    // ------------------------------------------------------------------

    @Test
    void aSupplierCannotReadAnotherSuppliersDocuments() throws Exception {
        Proveedor dueno = crearProveedor("DOC-4", "doc.4@example.com");
        Proveedor intruso = crearProveedor("DOC-5", "doc.5@example.com");
        registrarDocumento(dueno, "RUT", VIGENTE);

        mockMvc.perform(get("/api/proveedores/" + dueno.getId().valor() + "/documentos")
                        .header("Authorization", bearer(jwt(intruso))))
                .andExpect(status().isForbidden())
                // A denial raised inside the controller is rendered by the security
                // layer, which writes the ApiError payload as a one-element array.
                .andExpect(jsonPath("$[0].status").value(403));

        // The owner reads its own documentation through the same path.
        mockMvc.perform(get("/api/proveedores/" + dueno.getId().valor() + "/documentos")
                        .header("Authorization", bearer(jwt(dueno))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Roles outside the supplier module are refused before ownership is even asked.
        for (String token : new String[] { jwtDeRol(504L, Rol.TECNICO), jwtDeRol(505L, Rol.CLIENTE) }) {
            mockMvc.perform(get("/api/proveedores/" + dueno.getId().valor() + "/documentos")
                    .header("Authorization", bearer(token))).andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/proveedores/" + dueno.getId().valor() + "/documentos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aMalformedSupplierIdIsBadRequest() throws Exception {
        Proveedor proveedor = crearProveedor("DOC-6", "doc.6@example.com");

        mockMvc.perform(get("/api/proveedores/no-es-uuid/documentos")
                        .header("Authorization", bearer(adminJwt())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    // ------------------------------------------------------------------
    // 3. An administrator approves a supplier and reads their documents.
    // ------------------------------------------------------------------

    @Test
    void adminApprovesASupplierAndReadsTheirDocuments() throws Exception {
        Proveedor proveedor = crearProveedor("VAL-1", "val.1@example.com");
        registrarDocumento(proveedor, "RUT", VIGENTE);

        mockMvc.perform(get("/api/proveedores/" + proveedor.getId().valor() + "/documentos")
                        .header("Authorization", bearer(adminJwt())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tipo").value("RUT"));

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNoContent());

        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                aprobado -> assertThat(aprobado.getEstadoValidacion())
                        .isEqualTo(EstadoValidacionProveedor.APROBADO));
    }

    @Test
    void theValidationDecisionIsAdministratorOnly() throws Exception {
        Proveedor proveedor = crearProveedor("VAL-2", "val.2@example.com");
        registrarDocumento(proveedor, "RUT", VIGENTE);
        String ruta = "/api/proveedores/" + proveedor.getId().valor() + "/validacion";

        // A supplier cannot approve itself.
        mockMvc.perform(patch(ruta).header("Authorization", bearer(jwt(proveedor)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isForbidden());

        for (Rol rol : List.of(Rol.TECNICO, Rol.CLIENTE, Rol.PROVEEDOR)) {
            mockMvc.perform(patch(ruta).header("Authorization", bearer(jwtDeRol(506L, rol)))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(patch(ruta).contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isUnauthorized());

        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                intacto -> assertThat(intacto.getEstadoValidacion())
                        .isEqualTo(EstadoValidacionProveedor.PENDIENTE));
    }

    // ------------------------------------------------------------------
    // 4. The end-to-end unblock, which is the point of the whole slice.
    // ------------------------------------------------------------------

    @Test
    void aPendingSupplierIsRefusedAnInsumoAndCanOnlyAcceptOnceAnAdminApproves() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-1", "e2e.1@example.com");
        OfertaInsumo oferta = ofertaPara(proveedor);

        // Before the decision: the supplier is active and holds a live offer, and it
        // is still refused — proving the gate, not the eligibility rule, is the blocker.
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        registrarDocumento(proveedor, "RUT", VIGENTE);
        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNoContent());

        // Same supplier, same offer, now accepted.
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ASIGNADO"));
    }

    // ------------------------------------------------------------------
    // 5. Rejection records the reason and blocks the same operations.
    // ------------------------------------------------------------------

    @Test
    void rejectionRecordsTheReasonAndBlocksTheSameOperations() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-2", "e2e.2@example.com");
        registrarDocumento(proveedor, "RUT", VIGENTE);
        OfertaInsumo oferta = ofertaPara(proveedor);

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accion\":\"RECHAZAR\",\"motivo\":\"RUT vencido\"}"))
                .andExpect(status().isNoContent());

        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(rechazado -> {
            assertThat(rechazado.getEstadoValidacion()).isEqualTo(EstadoValidacionProveedor.RECHAZADO);
            assertThat(rechazado.getMotivoRechazoValidacion()).isEqualTo("RUT vencido");
        });

        // A rejected supplier is as unable to operate as a pending one.
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isForbidden());

        // And it can be re-evaluated: the state is retriable, not terminal.
        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNoContent());
        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                aprobado -> {
                    assertThat(aprobado.getEstadoValidacion())
                            .isEqualTo(EstadoValidacionProveedor.APROBADO);
                    assertThat(aprobado.getMotivoRechazoValidacion()).isNull();
                });
    }

    @Test
    void rejectingWithoutAMotiveIsBadRequest() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-3", "e2e.3@example.com");

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"RECHAZAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                intacto -> assertThat(intacto.getEstadoValidacion())
                        .isEqualTo(EstadoValidacionProveedor.PENDIENTE));
    }

    @Test
    void aSupplierWithNoDocumentsCannotBeApproved() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-4", "e2e.4@example.com");
        OfertaInsumo oferta = ofertaPara(proveedor);

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------
    // 6. Expired documents do not satisfy validation.
    // ------------------------------------------------------------------

    @Test
    void anExpiredDocumentDoesNotSatisfyValidation() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-5", "e2e.5@example.com");
        registrarDocumento(proveedor, "RUT", VENCIDO);
        OfertaInsumo oferta = ofertaPara(proveedor);

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                intacto -> assertThat(intacto.getEstadoValidacion())
                        .isEqualTo(EstadoValidacionProveedor.PENDIENTE));
        mockMvc.perform(post("/api/insumos/" + oferta.getId().valor() + "/aceptar")
                        .header("Authorization", bearer(jwt(proveedor))))
                .andExpect(status().isForbidden());
    }

    @Test
    void oneExpiredDocumentAmongVigenteOnesIsEnoughToRefuseTheApproval() throws Exception {
        Proveedor proveedor = crearProveedor("E2E-6", "e2e.6@example.com");
        registrarDocumento(proveedor, "RUT", VIGENTE);
        registrarDocumento(proveedor, "CEDULA", VENCIDO);

        mockMvc.perform(patch("/api/proveedores/" + proveedor.getId().valor() + "/validacion")
                        .header("Authorization", bearer(adminJwt()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isBadRequest());
        assertThat(proveedores.buscarPorId(proveedor.getId())).hasValueSatisfying(
                intacto -> assertThat(intacto.getEstadoValidacion())
                        .isEqualTo(EstadoValidacionProveedor.PENDIENTE));
    }

    // ------------------------------------------------------------------
    // 7. estadoValidacion travels on the supplier response.
    // ------------------------------------------------------------------

    @Test
    void theSupplierResponseCarriesTheValidationState() throws Exception {
        Proveedor pendiente = crearProveedor("RES-1", "res.1@example.com");
        Proveedor aprobado = crearProveedor("RES-2", "res.2@example.com");
        registrarDocumento(aprobado, "RUT", VIGENTE);
        mockMvc.perform(patch("/api/proveedores/" + aprobado.getId().valor() + "/validacion")
                .header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/proveedores").header("Authorization", bearer(adminJwt())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.nit=='RES-1')].estadoValidacion").value("PENDIENTE"))
                .andExpect(jsonPath("$[?(@.nit=='RES-2')].estadoValidacion").value("APROBADO"));

        // The rejected state is visible too, so an operator can act on it.
        mockMvc.perform(patch("/api/proveedores/" + pendiente.getId().valor() + "/validacion")
                .header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accion\":\"RECHAZAR\",\"motivo\":\"Falta RUT\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/proveedores").header("Authorization", bearer(adminJwt())))
                .andExpect(jsonPath("$[?(@.nit=='RES-1')].estadoValidacion").value("RECHAZADO"));
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

    /** A supplier created exactly as the admin endpoint creates it: PENDIENTE. */
    private Proveedor crearProveedor(String nit, String correo) {
        return proveedores.save(Proveedor.crear(crearUsuario(correo), "Suministros " + nit, nit, "3105550001",
                null, null, Set.of()));
    }

    private void registrarDocumento(Proveedor proveedor, String tipo, LocalDate vencimiento) throws Exception {
        mockMvc.perform(post("/api/proveedores/me/documentos")
                        .header("Authorization", bearer(jwt(proveedor)))
                        .contentType(MediaType.APPLICATION_JSON).content(documento(tipo, vencimiento.toString())))
                .andExpect(status().isCreated());
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

    private String documento(String tipo, String fechaVencimiento) {
        return "{\"tipo\":\"%s\",\"fechaVencimiento\":\"%s\"}".formatted(tipo, fechaVencimiento);
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

    private String adminJwt() {
        return jwtDeRol(999L, Rol.ADMINISTRADOR);
    }
}
