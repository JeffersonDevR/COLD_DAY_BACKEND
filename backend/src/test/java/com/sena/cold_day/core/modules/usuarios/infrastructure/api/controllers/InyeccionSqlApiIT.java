package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;

/**
 * Proves the request boundary treats classic SQL injection payloads as literal
 * data. The persistence port uses a Spring Data derived query
 * ({@code findByCorreo}) — no string concatenation — so a payload is bound as a
 * parameter, matches no row and can never run as SQL.
 *
 * <p>The HTTP leg also exercises the e-mail constraint: a payload submitted as
 * {@code correo} is rejected as an invalid address (400) before it reaches
 * persistence. The direct repository probe below documents the layer behind
 * that validation.
 */
@SpringBootTest
@AutoConfigureMockMvc
class InyeccionSqlApiIT {

    private static final String LOGIN = "/api/usuarios/login";
    private static final String TAUTOLOGIA = "' OR '1'='1' --";
    private static final String DROP_TABLE = "'; DROP TABLE usuario;--";

    @Autowired MockMvc mockMvc;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @AfterEach
    void cleanup() {
        usuarioRepository.deleteAll();
    }

    @Test
    void sqlInjectionPayloadsAreTreatedAsLiteralData() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload()))
                .andExpect(status().isCreated());
        assertThat(usuarioRepository.count()).isEqualTo(1);

        // Truthy tautology in the password: the account still does not authenticate.
        mockMvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"" + TAUTOLOGIA + "\"}"))
                .andExpect(status().isUnauthorized());

        // Stacked query / DROP submitted as the correo: rejected by the e-mail
        // constraint (400), never matched, never executed.
        mockMvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"" + DROP_TABLE + "\",\"password\":\"x\"}"))
                .andExpect(status().isBadRequest());

        // Direct probe of the persistence layer: the payload is a bound parameter,
        // so it is just a string that matches nothing.
        assertThat(usuarioRepository.findByCorreo(TAUTOLOGIA)).isEmpty();
        assertThat(usuarioRepository.findByCorreo(DROP_TABLE)).isEmpty();

        // The table is intact and the real account still authenticates.
        assertThat(usuarioRepository.count()).isEqualTo(1);
        mockMvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"secreto\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    private String validPayload() {
        return "{\"nombre\":\"Ana\",\"correo\":\"ana@example.com\",\"password\":\"secreto\","
                + "\"telefono\":\"3001234567\",\"aceptaHabeasData\":true}";
    }
}
