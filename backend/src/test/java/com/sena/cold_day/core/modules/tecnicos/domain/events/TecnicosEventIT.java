package com.sena.cold_day.core.modules.tecnicos.domain.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;

@SpringBootTest
@AutoConfigureMockMvc
class TecnicosEventIT {

    private static final List<Long> OBSERVED = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class EventRecordingConfiguration {
        @EventListener
        void onTecnicoCreado(TecnicoCreado event) { OBSERVED.add(event.tecnicoId()); }
    }

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository repository;
    @Autowired ObjectMapper objectMapper;

    @AfterEach
    void reset() { OBSERVED.clear(); repository.deleteAll(); }

    @Test
    void publishesTecnicoCreadoExactlyOnce() throws Exception {
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"123\",\"nombres\":\"Ana\",\"apellidos\":\"Garcia\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        JsonNode response = objectMapper.readTree(body);
        assertThat(OBSERVED).containsExactly(response.get("id").asLong());
    }
}
