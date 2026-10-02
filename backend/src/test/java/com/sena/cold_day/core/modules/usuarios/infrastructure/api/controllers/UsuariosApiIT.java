package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

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
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    void clearCaptures() { RECOVERIES.clear(); }

    @AfterEach
    void cleanup() {
        tokenRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void registersWithConsentLogsInAndRequestsRecovery() throws Exception {
        // The generic endpoint is permitAll, so it no longer accepts a
        // caller-supplied rol: the account is always created with the least
        // privilege (CLIENTE).
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload(true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rol").value("CLIENTE"))
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
                .andExpect(jsonPath("$.rol").value("CLIENTE"));

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
    void passwordResetRevokesTheTokenIssuedBeforeItAndNewLoginWorks() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload(true)))
                .andExpect(status().isCreated());

        // Token minted before the reset is usable.
        String preResetToken = loginAndGetToken("secreto");
        assertThat(protectedStatus(preResetToken)).isEqualTo(200);

        // Request + consume a recovery token (design D10).
        mockMvc.perform(post("/api/usuarios/recuperar-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\"}")).andExpect(status().isAccepted());
        assertThat(RECOVERIES).hasSize(1);
        String resetToken = RECOVERIES.get(0).token();
        mockMvc.perform(post("/api/usuarios/reset-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content(resetPayload(resetToken, "nueva-clave"))).andExpect(status().isNoContent());

        // The pre-reset token is now revoked (design D11).
        assertThat(protectedStatus(preResetToken)).isEqualTo(401);

        // A fresh login with the new password yields a usable token.
        String newToken = loginAndGetToken("nueva-clave");
        assertThat(protectedStatus(newToken)).isEqualTo(200);
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

    @Test
    void listingUsersRequiresAdministrador() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload(true)))
                .andExpect(status().isCreated());

        // No token -> 401.
        mockMvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized());

        // Non-admin -> 403.
        String tecnicoToken = tokenIssuer.emitir(new UsuarioId(1L), Rol.TECNICO, 0).valor();
        mockMvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + tecnicoToken))
                .andExpect(status().isForbidden());

        // Administrador -> 200 with every user, never exposing the password hash.
        // The listed user was created through POST /api/usuarios, which always
        // assigns CLIENTE; the listing must echo the role that was stored.
        String adminToken = tokenIssuer.emitir(new UsuarioId(999L), Rol.ADMINISTRADOR, 0).valor();
        mockMvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].correo").value("ana@example.com"))
                .andExpect(jsonPath("$[0].rol").value("CLIENTE"))
                .andExpect(jsonPath("$[0].password").doesNotExist())
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    /**
     * The stale {@code "rol":"TECNICO"} is kept on purpose: the endpoint no
     * longer declares that field, so Jackson drops it and the account is still
     * created as CLIENTE. Sending it proves the escalation path is closed.
     */
    private String validPayload(boolean aceptaHabeasData) {
        return "{\"nombre\":\"Ana\",\"correo\":\"ana@example.com\",\"password\":\"secreto\","
                + "\"telefono\":\"3001234567\",\"rol\":\"TECNICO\",\"aceptaHabeasData\":"
                + aceptaHabeasData + "}";
    }

    private String resetPayload(String token, String nuevaPassword) {
        return "{\"token\":\"" + token + "\",\"nuevaPassword\":\"" + nuevaPassword + "\"}";
    }

    private String loginAndGetToken(String password) throws Exception {
        String body = mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"ana@example.com\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    /**
     * "Is this token still accepted?" probe. It must target an endpoint that is
     * authenticated but NOT admin-only: {@code GET /api/tecnicos} is now
     * {@code hasRole('ADMINISTRADOR')}, so probing it would report 403 for a
     * perfectly valid CLIENTE token and blur the difference between "revoked"
     * (401) and "not an administrator" (403).
     * <p>
     * {@code GET /api/tecnicos/cercanos} ({@code hasAnyRole('CLIENTE','TECNICO')})
     * is the right probe: it needs only a location, returns 200 with an empty
     * list when nothing is nearby, and never depends on the caller owning a
     * domain profile. {@code GET /api/clientes/me/ots} was rejected because it
     * answers 404 when the user has no {@code Cliente} profile, which would be
     * indistinguishable from a revocation.
     */
    private int protectedStatus(String token) throws Exception {
        return mockMvc.perform(get("/api/tecnicos/cercanos").param("lat", "4.71").param("lng", "-74.07")
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getStatus();
    }
}
