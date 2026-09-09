package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class UsuariosApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired ObjectMapper objectMapper;

    @AfterEach
    void cleanup() { usuarioRepository.deleteAll(); }

    @Test
    void registersLogsInAndAcceptsHabeasData() throws Exception {
        String createdBody = mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rol").value("TECNICO"))
                .andExpect(jsonPath("$.habeasDataAceptado").value(false))
                .andReturn().getResponse().getContentAsString();
        String uid = objectMapper.readTree(createdBody).get("id").asText();

        // duplicate correo -> 409
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(validPayload()))
                .andExpect(status().isConflict());

        // login ok -> 200 + token
        String body = mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"secreto\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.rol").value("TECNICO"))
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(body).get("token").asText();

        // bad credentials -> 401
        mockMvc.perform(post("/api/usuarios/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\",\"password\":\"mal\"}"))
                .andExpect(status().isUnauthorized());

        // habeas data -> 204 with the token obtained at login
        mockMvc.perform(post("/api/usuarios/" + uid + "/habeas-data")
                .header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());

        // unknown user -> 404
        String adminToken = tokenIssuer.emitir(new UsuarioId(999999L), Rol.ADMINISTRADOR).valor();
        mockMvc.perform(post("/api/usuarios/999999/habeas-data")
                .header("Authorization", "Bearer " + adminToken)).andExpect(status().isNotFound());

        // recovery request -> 202 accepted (public)
        mockMvc.perform(post("/api/usuarios/recuperar-contrasena").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"ana@example.com\"}")).andExpect(status().isAccepted());
    }

    @Test
    void rejectsInvalidPayload() throws Exception {
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
    }

    private String validPayload() {
        return "{\"nombre\":\"Ana\",\"correo\":\"ana@example.com\",\"password\":\"secreto\","
                + "\"telefono\":\"3001234567\",\"rol\":\"TECNICO\"}";
    }
}
