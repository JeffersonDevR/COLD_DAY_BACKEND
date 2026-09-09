package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class TecnicosApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository repository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void cleanup() {
        repository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void createsListsUpdatesAndSoftDeletesTecnico() throws Exception {
        String payload = validPayload("123", "Ana");
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoOperativo").value("FUERA_DE_SERVICIO"))
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"))
                .andReturn().getResponse().getContentAsString();
        JsonNode created = objectMapper.readTree(body);
        String id = created.get("id").asText();

        // Public registration works; protected reads need a JWT.
        String adminToken = adminJwt();
        mockMvc.perform(get("/api/tecnicos").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numeroIdentificacion").value("123"))
                .andExpect(jsonPath("$[0].nombre").value("Ana"));

        String updated = validPayload("123", "Ana Maria");
        mockMvc.perform(put("/api/tecnicos/" + id).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(updated))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nombre").value("Ana Maria"));

        mockMvc.perform(delete("/api/tecnicos/" + id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tecnicos/" + id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsDuplicateCorreoWith409() throws Exception {
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload("123", "Ana"))).andExpect(status().isCreated());
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload("456", "Ana"))).andExpect(status().isConflict());
    }

    @Test
    void rejectsInvalidAndUnknownRequests() throws Exception {
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
        mockMvc.perform(get("/api/tecnicos/999").header("Authorization", "Bearer " + adminJwt()))
                .andExpect(status().isNotFound());
    }

    @Test
    void validationGateBlocksOperativeChangesUntilAdminApproves() throws Exception {
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                .content(validPayload("123", "Ana"))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(body).get("id").asText();
        String adminToken = adminJwt();

        // Not yet approved: operational change is forbidden (403, business rule)
        mockMvc.perform(put("/api/tecnicos/" + id + "/estado").header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"estadoOperativo\":\"DISPONIBLE\"}"))
                .andExpect(status().isForbidden());

        // RECHAZAR works without documents and forces FUERA_DE_SERVICIO
        mockMvc.perform(patch("/api/tecnicos/" + id + "/validacion")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"accion\":\"RECHAZAR\",\"motivo\":\"Docs vencidos\"}")).andExpect(status().isNoContent());
        mockMvc.perform(put("/api/tecnicos/" + id + "/estado").header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"estadoOperativo\":\"DISPONIBLE\"}"))
                .andExpect(status().isForbidden());

        // Register a vigente document and approve
        mockMvc.perform(post("/api/tecnicos/" + id + "/documentos")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tipo\":\"Cedula\",\"fechaVencimiento\":\"2030-01-01\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(patch("/api/tecnicos/" + id + "/validacion")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"accion\":\"APROBAR\"}")).andExpect(status().isNoContent());

        // Now the operational switch works
        mockMvc.perform(put("/api/tecnicos/" + id + "/estado").header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"estadoOperativo\":\"DISPONIBLE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estadoOperativo").value("DISPONIBLE"))
                .andExpect(jsonPath("$.estadoValidacion").value("APROBADO"));
    }

    private String adminJwt() {
        return tokenIssuer.emitir(new UsuarioId(999L), Rol.ADMINISTRADOR).valor();
    }

    private String validPayload(String numeroIdentificacion, String nombre) {
        return ("{\"numeroIdentificacion\":\"%s\",\"nombre\":\"%s\",\"correo\":\"ana@example.com\","
                + "\"password\":\"secreto\",\"telefono\":\"3001234567\","
                + "\"categoriasServicio\":[\"REFRIGERACION\"]}").formatted(numeroIdentificacion, nombre);
    }
}
