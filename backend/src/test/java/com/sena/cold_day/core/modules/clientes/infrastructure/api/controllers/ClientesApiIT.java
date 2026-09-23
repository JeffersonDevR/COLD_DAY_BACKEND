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
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;

/**
 * Client onboarding IT (spec capability {@code cliente-onboarding}): {@code POST
 * /api/clientes} is a public endpoint that creates the Usuario (rol CLIENTE) and
 * its profile from the request body in a single transaction, so no JWT is
 * required and the profile is never derived from an authenticated principal.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ClientesApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void createsUsuarioAndProfileOnPublicOnboarding() throws Exception {
        String correo = "nuevo@example.com";

        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(payload(correo, "Centro")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.usuarioId").isNumber())
                .andExpect(jsonPath("$.nombre").value("Ana"))
                .andExpect(jsonPath("$.correo").value(correo))
                .andExpect(jsonPath("$.tipoCliente").value("B2C"))
                .andExpect(jsonPath("$.direccion.calle").value("Calle 1"))
                .andExpect(jsonPath("$.activo").value(true));

        assertThat(usuarioRepository.findByCorreo(correo)).hasValueSatisfying(usuario -> {
            assertThat(usuario.getRol()).isEqualTo(Rol.CLIENTE);
            assertThat(usuario.getPasswordHash()).isNotEqualTo("secreto");
        });
        assertThat(clienteRepository.findByActivoTrue()).hasSize(1);
    }

    @Test
    void onboardsWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(payload("publico@example.com", "Centro")))
                .andExpect(status().isCreated());
    }

    @Test
    void acceptsOnboardingWithoutOptionalFields() throws Exception {
        String body = "{\"nombre\":\"Ana\",\"correo\":\"opcional@example.com\",\"password\":\"secreto\","
                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                + "\"aceptaHabeasData\":true}";

        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.direccion.ciudad").value("Bogota"))
                .andExpect(jsonPath("$.activo").value(true));

        assertThat(clienteRepository.findByActivoTrue()).hasSize(1);
    }

    @Test
    void rejectsDuplicateCorreoWithConflict() throws Exception {
        String correo = "duplicado@example.com";

        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                .content(payload(correo, "Centro"))).andExpect(status().isCreated());
        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                .content(payload(correo, "Centro"))).andExpect(status().isConflict());

        assertThat(clienteRepository.findByActivoTrue()).hasSize(1);
        assertThat(usuarioRepository.existsByCorreo(correo)).isTrue();
    }

    @Test
    void rejectsInvalidPayloadWithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON).content("{\"barrio\":\"Centro\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());

        assertThat(clienteRepository.findByActivoTrue()).isEmpty();
    }

    private String payload(String correo, String barrio) {
        return ("{\"nombre\":\"Ana\",\"correo\":\"%s\",\"password\":\"secreto\","
                + "\"telefono\":\"3001234567\",\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\","
                + "\"ciudad\":\"Bogota\",\"barrio\":\"%s\",\"aceptaHabeasData\":true}")
                .formatted(correo, barrio);
    }
}
