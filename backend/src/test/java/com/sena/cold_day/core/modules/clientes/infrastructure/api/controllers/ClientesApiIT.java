package com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers;

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
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * Client onboarding IT (spec capability {@code cliente-onboarding}): the profile
 * is created for the usuario derived from the authenticated principal (carried
 * decision D6), never from the request body.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ClientesApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void createsProfileForTheAuthenticatedUsuario() throws Exception {
        Long usuarioId = persistUsuario("cliente@example.com");
        String token = jwt(new UsuarioId(usuarioId));

        mockMvc.perform(post("/api/clientes").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"barrio\":\"Centro\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId.intValue()))
                .andExpect(jsonPath("$.tipoCliente").value("B2C"))
                .andExpect(jsonPath("$.direccion.calle").value("Calle 1"))
                .andExpect(jsonPath("$.activo").value(true));

        assertThat(clienteRepository.findByUsuarioId(new UsuarioId(usuarioId)))
                .hasValueSatisfying(cliente -> {
                    assertThat(cliente.getUsuarioId()).isEqualTo(new UsuarioId(usuarioId));
                    assertThat(cliente.getTipoCliente()).isEqualTo(TipoCliente.B2C);
                    assertThat(cliente.getDireccionPrincipal().getCalle()).isEqualTo("Calle 1");
                    assertThat(cliente.isActivo()).isTrue();
                });
    }

    @Test
    void rejectsUnauthenticatedRequests() throws Exception {
        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$[0].status").value(401));
    }

    @Test
    void returnsNotFoundWhenThePrincipalHasNoUsuario() throws Exception {
        String token = jwt(new UsuarioId(987654321L));

        mockMvc.perform(post("/api/clientes").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));

        assertThat(clienteRepository.findByActivoTrue()).isEmpty();
    }

    @Test
    void rejectsDuplicateProfileWithConflict() throws Exception {
        Long usuarioId = persistUsuario("duplicado@example.com");
        String token = jwt(new UsuarioId(usuarioId));
        String payload = "{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}";

        mockMvc.perform(post("/api/clientes").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isCreated());
        mockMvc.perform(post("/api/clientes").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isConflict());

        assertThat(clienteRepository.findByActivoTrue()).hasSize(1);
    }

    @Test
    void rejectsInvalidPayloadWithFieldErrors() throws Exception {
        Long usuarioId = persistUsuario("invalido@example.com");
        String token = jwt(new UsuarioId(usuarioId));

        mockMvc.perform(post("/api/clientes").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"barrio\":\"Centro\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());

        assertThat(clienteRepository.findByActivoTrue()).isEmpty();
    }

    private Long persistUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, Rol.CLIENTE, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(UsuarioId usuarioId) {
        return tokenIssuer.emitir(usuarioId, Rol.CLIENTE, 0).valor();
    }
}
