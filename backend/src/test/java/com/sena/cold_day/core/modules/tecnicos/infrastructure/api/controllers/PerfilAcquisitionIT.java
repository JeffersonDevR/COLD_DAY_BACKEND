package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
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

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import tools.jackson.databind.ObjectMapper;

/**
 * Second-profile acquisition IT (spec capability
 * {@code second-profile-acquisition}): both endpoints are bound to the
 * authenticated principal, the created role comes only from the profile type
 * (M5), a duplicate is rejected with 409, and the principal's token version is
 * bumped so the new capability is honored at the next login.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PerfilAcquisitionIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void cleanup() {
        tecnicoRepository.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void acquiresTecnicoProfileForThePrincipalAndBumpsTokenVersion() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec@example.com");
        String token = jwt(usuarioId, Rol.CLIENTE, 0);

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-1\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"))
                .andExpect(jsonPath("$.numeroIdentificacion").value("T-1"));

        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isPresent();
        assertThat(usuarioRepository.findByCorreo("dual-tec@example.com").orElseThrow().getTokenVersion()).isEqualTo(1);

        // The pre-acquisition token is revoked: the new capability requires a re-login.
        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-1b\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsDuplicateTecnicoProfileWith409() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec-dup@example.com");
        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-2\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-2b\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void ignoresRoleInBodyWhenAcquiringTecnicoProfile() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec-m5@example.com");

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-3\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"rol\":\"ADMINISTRADOR\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"));

        // The body role is dropped: the usuario keeps its registration role and
        // the created profile is the technician one, never an administrator.
        assertThat(usuarioRepository.findByCorreo("dual-tec-m5@example.com").orElseThrow().getRol())
                .isEqualTo(Rol.CLIENTE);
        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isPresent();
    }

    @Test
    void acquiresClienteProfileForThePrincipalAndBumpsTokenVersion() throws Exception {
        long usuarioId = registrarTecnicoPublico("dual-cli@example.com");
        String token = jwt(usuarioId, Rol.TECNICO, 0);

        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.tipoCliente").value("B2C"));

        assertThat(clienteRepository.findByUsuarioId(new UsuarioId(usuarioId))).isPresent();
        assertThat(usuarioRepository.findByCorreo("dual-cli@example.com").orElseThrow().getTokenVersion()).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateClienteProfileWith409() throws Exception {
        long usuarioId = registrarTecnicoPublico("dual-cli-dup@example.com");
        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO, 1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 2\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void requiresAuthenticationForBothEndpoints() throws Exception {
        mockMvc.perform(post("/api/tecnicos/perfil").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-4\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/clientes/perfil").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isUnauthorized());
    }

    private long registrarClientePublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"nombre\":\"Ana\",\"correo\":\"%s\",\"password\":\"secreto\","
                                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private long registrarTecnicoPublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"numeroIdentificacion\":\"P-1\",\"nombre\":\"Ana\",\"correo\":\"%s\","
                                + "\"password\":\"secreto\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private String jwt(long usuarioId, Rol rol, int tokenVersion) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, tokenVersion).valor();
    }
}
