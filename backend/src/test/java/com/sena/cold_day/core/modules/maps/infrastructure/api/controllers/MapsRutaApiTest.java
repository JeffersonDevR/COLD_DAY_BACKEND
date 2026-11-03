package com.sena.cold_day.core.modules.maps.infrastructure.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.maps.domain.model.Ruta;
import com.sena.cold_day.core.modules.maps.domain.services.MapsPort;
import com.sena.cold_day.core.modules.maps.infrastructure.cache.RutaCache;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;

/**
 * Controller slice of {@code POST /api/maps/ruta}: the exact JSON contract the
 * tracking map consumes, the deterministic 400 of the bean validation, the 404
 * of "no route" and the 503 of an unavailable Maps, all through the real
 * {@link MapsControllerAdvice} and without a Spring context, Docker or network.
 *
 * <p>Authentication is enforced by the security chain ({@code anyRequest()
 * .authenticated()} plus the class-level {@code @PreAuthorize}) and is not part
 * of this slice: building a security context here would only re-test Spring
 * Security, not the route contract.
 */
class MapsRutaApiTest {

    /** Round coordinates kept inside the valid ranges. */
    private static final String ORIGEN = "{\"lat\":7.8,\"lng\":-72.5}";
    private static final String DESTINO = "{\"lat\":7.9,\"lng\":-72.6}";
    private static final String CUERPO = "{\"origen\":" + ORIGEN + ",\"destino\":" + DESTINO + "}";

    private MapsPort maps;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        maps = mock(MapsPort.class);
        mockMvc = mvc(true, "server-key");
    }

    @Test
    void devuelveLaRutaConElContratoCamelCaseYLosTresCampos() throws Exception {
        when(maps.ruta(7.8, -72.5, 7.9, -72.6))
                .thenReturn(Optional.of(new Ruta(4.2, 11.5, "encoded_polyline")));

        mockMvc.perform(post("/api/maps/ruta").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distanciaKm").value(4.2))
                .andExpect(jsonPath("$.duracionMin").value(11.5))
                .andExpect(jsonPath("$.polyline").value("encoded_polyline"))
                // The raw Google payload never leaves the backend: three fields,
                // none of them routes/legs/copyrights.
                .andExpect(jsonPath("$.*", hasSize(3)))
                .andExpect(content().string(not(containsString("legs"))));
    }

    @Test
    void rechazaUnPuntoFueraDeRangoCon400YApiError() throws Exception {
        mockMvc.perform(post("/api/maps/ruta")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origen\":{\"lat\":120.0,\"lng\":-72.5},\"destino\":" + DESTINO + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors", not(hasSize(0))))
                .andExpect(jsonPath("$.fieldErrors[0]", containsString("origen.lat")));

        verifyNoInteractions(maps);
    }

    @Test
    void rechazaUnaLongitudFueraDeRango() throws Exception {
        mockMvc.perform(post("/api/maps/ruta")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origen\":" + ORIGEN + ",\"destino\":{\"lat\":7.9,\"lng\":200.0}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(maps);
    }

    @Test
    void exigeLosDosExtremos() throws Exception {
        mockMvc.perform(post("/api/maps/ruta")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origen\":" + ORIGEN + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors[0]", containsString("destino")));

        verifyNoInteractions(maps);
    }

    @Test
    void responde404CuandoGoogleNoTieneRuta() throws Exception {
        when(maps.ruta(7.8, -72.5, 7.9, -72.6)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/maps/ruta").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
                .andExpect(status().isNotFound());
    }

    @Test
    void responde503ConApiErrorCuandoMapsNoEstaConfigurado() throws Exception {
        mockMvc = mvc(true, "");

        mockMvc.perform(post("/api/maps/ruta").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$[0].status").value(503));

        verifyNoInteractions(maps);
    }

    @Test
    void responde503CuandoMapsEstaDeshabilitado() throws Exception {
        mockMvc = mvc(false, "server-key");

        mockMvc.perform(post("/api/maps/ruta").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$[0].status").value(503));

        verifyNoInteractions(maps);
    }

    private MockMvc mvc(boolean enabled, String apiKey) {
        MapsProperties props = new MapsProperties(apiKey, enabled, "es", "CO", 4000, 60, 200);
        MapsUseCase useCase = new MapsUseCase(maps, props, new RutaCache(props));
        return MockMvcBuilders.standaloneSetup(new MapsController(useCase))
                .setControllerAdvice(new MapsControllerAdvice())
                .build();
    }
}
