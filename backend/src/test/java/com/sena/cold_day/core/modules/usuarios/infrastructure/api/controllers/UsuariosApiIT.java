package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataTokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;

@SpringBootTest
@AutoConfigureMockMvc
class UsuariosApiIT {

    private static final List<RecuperacionSolicitada> RECOVERIES = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class RecoveryCaptureConfiguration {
        @EventListener
        void onRecovery(RecuperacionSolicitada event) { RECOVERIES.add(event); }
    }

    @Autowired MockMvc mockMvc;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataTokenRecuperacionRepository tokenRepository;

    @BeforeEach
    void clearCaptures() { RECOVERIES.clear(); }

    @AfterEach
    void cleanup() {
        tokenRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void registersWithConsentLogsInAndRequestsRecovery() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload(true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rol").value("TECNICO"))
                .andExpect(jsonPath("$.habeasDataAceptado").value(true));
        assertThat(usuarioRepository.count()).isEqualTo(1);

        // duplicate correo -> 409
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload(true)))
                .andExpect(status().isConflict());

        // login ok -> 200 + token
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"secreto\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.rol").value("TECNICO"));

        // bad credentials -> 401
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"mal\"}"))
                .andExpect(status().isUnauthorized());

        // recovery request -> 202 accepted (public)
        mockMvc.perform(post("/api/usuarios/recuperar-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\"}")).andExpect(status().isAccepted());
    }

    @Test
    void resetFlowIsSingleUseAndDoesNotEnumerateAccounts() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload(true)))
                .andExpect(status().isCreated());

        // Unknown email -> same 202, no token, no event.
        mockMvc.perform(post("/api/usuarios/recuperar-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"nadie@example.com\"}")).andExpect(status().isAccepted());
        assertThat(RECOVERIES).isEmpty();
        assertThat(tokenRepository.count()).isZero();

        // Known active email -> 202, one hashed token persisted, event carries the plain token.
        mockMvc.perform(post("/api/usuarios/recuperar-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\"}")).andExpect(status().isAccepted());
        assertThat(RECOVERIES).hasSize(1);
        assertThat(tokenRepository.count()).isEqualTo(1);
        String token = RECOVERIES.get(0).token();
        assertThat(token).isNotBlank();

        // Unknown token -> generic 400.
        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"no-existe\",\"nuevaPassword\":\"nueva-clave\"}"))
                .andExpect(status().isBadRequest());

        // Valid reset -> 204.
        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content(resetPayload(token, "nueva-clave"))).andExpect(status().isNoContent());

        // The token was single-use: reusing it -> 400 and the password is untouched.
        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content(resetPayload(token, "otra-clave"))).andExpect(status().isBadRequest());

        // Old password rejected; the new one authenticates.
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"secreto\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"nueva-clave\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void rejectsRegistrationWithoutHabeasDataConsentAndPersistsNothing() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload(false)))
                .andExpect(status().isBadRequest());

        assertThat(usuarioRepository.count()).isZero();
    }

    @Test
    void rejectsInvalidPayload() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
    }

    private String validPayload(boolean aceptaHabeasData) {
        return "{\"nombre\":\"Ana\",\"correo\":\"ana@example.com\",\"password\":\"secreto\","
                + "\"telefono\":\"3001234567\",\"rol\":\"TECNICO\",\"aceptaHabeasData\":"
                + aceptaHabeasData + "}";
    }

    private String resetPayload(String token, String nuevaPassword) {
        return "{\"token\":\"" + token + "\",\"nuevaPassword\":\"" + nuevaPassword + "\"}";
    }
}
