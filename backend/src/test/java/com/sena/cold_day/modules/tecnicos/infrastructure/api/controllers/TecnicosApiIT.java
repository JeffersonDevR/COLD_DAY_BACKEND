package com.sena.cold_day.modules.tecnicos.infrastructure.api.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;

@SpringBootTest
@AutoConfigureMockMvc
class TecnicosApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository repository;

    @AfterEach
    void cleanup() { repository.deleteAll(); }

    @Test
    void createsListsUpdatesAndSoftDeletesTecnico() throws Exception {
        String payload = validPayload("123", "Ana");
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.estadoOperativo").value("DISPONIBLE"));
        mockMvc.perform(get("/api/tecnicos")).andExpect(status().isOk()).andExpect(jsonPath("$[0].numeroIdentificacion").value("123"));
        mockMvc.perform(put("/api/tecnicos/1").contentType(MediaType.APPLICATION_JSON).content(validPayload("123", "Ana Maria")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nombres").value("Ana Maria"));
        mockMvc.perform(delete("/api/tecnicos/1")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tecnicos/1")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidAndUnknownRequests() throws Exception {
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
        mockMvc.perform(get("/api/tecnicos/999")).andExpect(status().isNotFound());
    }

    private String validPayload(String id, String name) {
        return "{\"numeroIdentificacion\":\"%s\",\"nombres\":\"%s\",\"apellidos\":\"Garcia\",\"email\":\"ana@example.com\"}"
                .formatted(id, name);
    }
}
