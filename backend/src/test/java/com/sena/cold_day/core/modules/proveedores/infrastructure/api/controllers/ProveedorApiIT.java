package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * End-to-end admin supplier surface (spec P1/P2/P4/P5, prov.S1.1–S5.1).
 *
 * <p>Duplicate {@code nit} is deliberately not pre-checked; the module maps the
 * {@code UNIQUE(nit)} constraint violation to 409 (see {@link ProveedorControllerAdvice})
 * so it can never surface as an unhandled 500, and the transaction rolls back.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProveedorApiIT {

    private static final String RAZON = "Suministros del Norte";

    @Autowired MockMvc mockMvc;
    @Autowired ProveedorRepository proveedorRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        proveedorRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void adminProvisionsSupplierWithProveedorRoleAndNoCredentials() throws Exception {
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-1", "prov.a@coldday.com.co")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.usuarioId").isNumber())
                .andExpect(jsonPath("$.razonSocial").value(RAZON))
                .andExpect(jsonPath("$.nit").value("NIT-1"))
                .andExpect(jsonPath("$.activo").value(true))
                // The initial password is never echoed back in any response.
                .andExpect(jsonPath("$.password").doesNotExist());

        UsuarioJpaEntity usuario = usuarioRepository.findByCorreo("prov.a@coldday.com.co").orElseThrow();
        assertThat(usuario.getRol()).isEqualTo(Rol.PROVEEDOR);
        assertThat(proveedorRepository.findByUsuarioId(usuario.getId())).isPresent();
    }

    @Test
    void rejectsInvalidSupplierDataWith400AndCreatesNothing() throws Exception {
        // Missing razonSocial and nit.
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Ana\",\"correo\":\"prov.b@coldday.com.co\",\"password\":\"secreto123\","
                        + "\"aceptaHabeasData\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());

        // Habeas Data consent is a mandatory registration invariant.
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Ana\",\"correo\":\"prov.b@coldday.com.co\",\"password\":\"secreto123\","
                        + "\"razonSocial\":\"X\",\"nit\":\"NIT-B\",\"aceptaHabeasData\":false}"))
                .andExpect(status().isBadRequest());

        assertThat(proveedorRepository.findAll()).isEmpty();
        assertThat(usuarioRepository.findByCorreo("prov.b@coldday.com.co")).isEmpty();
    }

    @Test
    void rejectsDuplicateCorreoWith409() throws Exception {
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-2", "prov.c@coldday.com.co")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-3", "prov.c@coldday.com.co")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void rejectsDuplicateNitWith409AndRollsBackTheAccount() throws Exception {
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-DUP", "prov.d1@coldday.com.co")))
                .andExpect(status().isCreated());

        // Same NIT, different correo: the UNIQUE(nit) violation is a 409, never a 500.
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-DUP", "prov.d2@coldday.com.co")))
                .andExpect(status().isConflict());

        // The whole unit rolled back: no half-created account for the second correo.
        assertThat(usuarioRepository.findByCorreo("prov.d2@coldday.com.co")).isEmpty();
        assertThat(proveedorRepository.findAll()).hasSize(1);
    }

    @Test
    void nonAdminCannotCreateSupplier() throws Exception {
        for (String token : new String[] { tecnicoJwt(), clienteJwt(), proveedorJwt() }) {
            mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON).content(payload("NIT-4", "prov.e@coldday.com.co")))
                    .andExpect(status().isForbidden());
        }
        assertThat(proveedorRepository.findAll()).isEmpty();
    }

    @Test
    void unauthenticatedCreationIsNotExposed() throws Exception {
        mockMvc.perform(post("/api/proveedores").contentType(MediaType.APPLICATION_JSON)
                .content(payload("NIT-5", "prov.f@coldday.com.co")))
                .andExpect(status().isUnauthorized());
        assertThat(proveedorRepository.findAll()).isEmpty();
    }

    @Test
    void adminListsSuppliersIncludingInactive() throws Exception {
        createSupplier("NIT-ACT", "prov.g1@coldday.com.co");
        createSupplier("NIT-INACT", "prov.g2@coldday.com.co");
        deactivate("prov.g2@coldday.com.co");

        mockMvc.perform(get("/api/proveedores").header("Authorization", bearer(adminJwt())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.nit=='NIT-ACT')].activo").value(true))
                .andExpect(jsonPath("$[?(@.nit=='NIT-INACT')].activo").value(false));

        // P5: the inactive supplier is excluded from the eligibility read.
        assertThat(proveedorRepository.findByActivoTrue()).hasSize(1);
    }

    @Test
    void nonAdminCannotListSuppliers() throws Exception {
        for (String token : new String[] { tecnicoJwt(), proveedorJwt(), clienteJwt() }) {
            mockMvc.perform(get("/api/proveedores").header("Authorization", bearer(token)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void supplierRoleIsIssuedOnLoginAndBoundaryIsEnforced() throws Exception {
        createSupplier("NIT-6", "prov.h@coldday.com.co");

        // prov.S1.1: the issued credentials carry the PROVEEDOR role.
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"prov.h@coldday.com.co\",\"password\":\"secreto123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("PROVEEDOR"));

        // prov.S3.3: a supplier is blocked from unrelated operations (admin and tecnico surfaces).
        mockMvc.perform(get("/api/proveedores").header("Authorization", bearer(proveedorJwt())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/tecnicos/me/ots").header("Authorization", bearer(proveedorJwt())))
                .andExpect(status().isForbidden());
    }

    private void createSupplier(String nit, String correo) throws Exception {
        mockMvc.perform(post("/api/proveedores").header("Authorization", bearer(adminJwt()))
                .contentType(MediaType.APPLICATION_JSON).content(payload(nit, correo)))
                .andExpect(status().isCreated());
    }

    private void deactivate(String correo) {
        UsuarioJpaEntity usuario = usuarioRepository.findByCorreo(correo).orElseThrow();
        Proveedor proveedor = proveedorRepository.findByUsuarioId(usuario.getId()).orElseThrow();
        proveedor.desactivar();
        proveedorRepository.save(proveedor);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String adminJwt() {
        return tokenIssuer.emitir(new UsuarioId(999L), Rol.ADMINISTRADOR, 0).valor();
    }

    private String tecnicoJwt() {
        return tokenIssuer.emitir(new UsuarioId(998L), Rol.TECNICO, 0).valor();
    }

    private String clienteJwt() {
        return tokenIssuer.emitir(new UsuarioId(997L), Rol.CLIENTE, 0).valor();
    }

    private String proveedorJwt() {
        return tokenIssuer.emitir(new UsuarioId(996L), Rol.PROVEEDOR, 0).valor();
    }

    private String payload(String nit, String correo) {
        return ("{\"nombre\":\"Ana Proveedor\",\"correo\":\"%s\",\"password\":\"secreto123\","
                + "\"telefono\":\"3105550001\",\"razonSocial\":\"%s\",\"nit\":\"%s\",\"aceptaHabeasData\":true}")
                .formatted(correo, RAZON, nit);
    }
}
