package com.sena.cold_day.core.shared.infrastructure.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Security layer IT (section 5): real JWTs via JwtTokenIssuer — no
 * @WithMockUser. No token → 401; wrong rol → 403; ADMINISTRADOR → allowed.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadIT {

    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenIssuer tokenIssuer;

    @Test
    void protectedRoutesRequireToken() throws Exception {
        mockMvc.perform(get("/api/tecnicos"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$[0].status").value(401));
    }

    @Test
    void wrongRolGets403OnValidacion() throws Exception {
        String tecnicoToken = tokenIssuer.emitir(new UsuarioId(7L), Rol.TECNICO).valor();
        mockMvc.perform(patch("/api/tecnicos/1/validacion")
                        .header("Authorization", "Bearer " + tecnicoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accion\":\"APROBAR\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void administradorCanReachValidacion() throws Exception {
        String adminToken = tokenIssuer.emitir(new UsuarioId(999L), Rol.ADMINISTRADOR).valor();
        mockMvc.perform(patch("/api/tecnicos/999999/validacion")
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
}
