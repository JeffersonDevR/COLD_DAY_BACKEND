package com.sena.cold_day.core.shared.infrastructure.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;

/**
 * Security layer IT (section 5): real JWTs via JwtTokenIssuer — no
 * @WithMockUser. No token → 401; wrong rol → 403; ADMINISTRADOR → allowed.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadIT {

    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @AfterEach
    void cleanup() {
        usuarioRepository.deleteAll();
    }

    private Long persistUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", null, null, Rol.CLIENTE, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    @Test
    void protectedRoutesRequireToken() throws Exception {
        mockMvc.perform(get("/api/tecnicos"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$[0].status").value(401));
    }

    @Test
    void errorDispatchPreservesTheOriginalNotFoundStatusWithoutAnotherAuthenticationChallenge() throws Exception {
        mockMvc.perform(get("/error")
                        .with(request -> {
                            request.setDispatcherType(DispatcherType.ERROR);
                            return request;
                        })
                        .requestAttr(RequestDispatcher.ERROR_STATUS_CODE, 404)
                        .requestAttr(RequestDispatcher.ERROR_REQUEST_URI, "/api/ot/123/tecnico-ubicacion"))
                .andExpect(status().isNotFound());
    }

    @Test
    void wrongRolGets403OnValidacion() throws Exception {
        String tecnicoToken = tokenIssuer.emitir(new UsuarioId(7L), Rol.TECNICO, 0).valor();
        mockMvc.perform(patch("/api/tecnicos/1/validacion")
                        .header("Authorization", "Bearer " + tecnicoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void administradorCanReachValidacion() throws Exception {
        String adminToken = tokenIssuer.emitir(new UsuarioId(999L), Rol.ADMINISTRADOR, 0).valor();
        // Own-UUID identity (design D12): a well-formed but unknown UUID reaches
        // the controller and yields 404 (a non-UUID segment would fail binding).
        mockMvc.perform(patch("/api/tecnicos/" + UUID.randomUUID() + "/validacion")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void invalidTokensAreRejected() throws Exception {
        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer no-es-un-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenIssuedBeforeTheVersionBumpIsRevoked() throws Exception {
        Long usuarioId = persistUsuario("revocado@example.com");
        String tokenAntesDelReset = tokenIssuer.emitir(new UsuarioId(usuarioId), Rol.CLIENTE, 0).valor();

        // Baseline: the fresh token authenticates.
        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer " + tokenAntesDelReset))
                .andExpect(status().isOk());

        // A password reset bumps the persisted token version (design D11).
        UsuarioJpaEntity persisted = usuarioRepository.findById(usuarioId).orElseThrow();
        persisted.setTokenVersion(1);
        usuarioRepository.saveAndFlush(persisted);

        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer " + tokenAntesDelReset))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$[0].status").value(401));
    }
}
