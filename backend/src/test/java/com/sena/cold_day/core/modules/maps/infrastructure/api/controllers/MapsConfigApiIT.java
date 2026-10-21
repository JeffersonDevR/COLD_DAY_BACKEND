package com.sena.cold_day.core.modules.maps.infrastructure.api.controllers;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;

/**
 * Map view configuration (GET /api/config/maps): the frontend reads it instead
 * of duplicating the literals.
 *
 * <p>The suite pins the source of every value: the ones overridden here come
 * from the configuration, the untouched ones keep the defaults declared in
 * {@code application.properties}. The tariff inherits the center, so the metro
 * center lives in a single place.
 */
@SpringBootTest(properties = {
        "app.maps.api-key=SERVER-KEY-NUNCA-SE-ENTREGA",
        "app.maps.browser-api-key=BROWSER-KEY",
        "app.maps.centro-lat=1.25",
        "app.maps.zoom=9"
})
@AutoConfigureMockMvc
class MapsConfigApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired TarifaProperties tarifaProperties;

    @Test
    void respondeLaConfiguracionDelMapaSinToken() throws Exception {
        mockMvc.perform(get("/api/config/maps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.centro.lat").value(1.25))
                .andExpect(jsonPath("$.centro.lng").value(-72.5078))
                .andExpect(jsonPath("$.bounds.north").value(8.08))
                .andExpect(jsonPath("$.bounds.south").value(7.76))
                .andExpect(jsonPath("$.bounds.east").value(-72.41))
                .andExpect(jsonPath("$.bounds.west").value(-72.6))
                .andExpect(jsonPath("$.zoom").value(9))
                .andExpect(jsonPath("$.radioInicialKm").value(10))
                .andExpect(jsonPath("$.radioMaxKm").value(25))
                .andExpect(jsonPath("$.radioPasoKm").value(5));
    }

    @Test
    void laTarifaHereditaElCentroDelMapa() {
        Assertions.assertThat(tarifaProperties.centroLat()).isEqualTo(1.25);
    }

    @Test
    void entregaSoloLaBrowserKeyYNuncaLaServerKey() throws Exception {
        mockMvc.perform(get("/api/config/maps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKey").value("BROWSER-KEY"))
                .andExpect(content().string(not(containsString("SERVER-KEY-NUNCA-SE-ENTREGA"))));
    }
}
