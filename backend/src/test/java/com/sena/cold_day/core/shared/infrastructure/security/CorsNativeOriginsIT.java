package com.sena.cold_day.core.shared.infrastructure.security;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Roadmap B1 (task T1 of {@code preparacion-ionic}): the Ionic app does not run
 * on a regular web origin — the Capacitor WebView sends a custom-scheme
 * {@code Origin} header ({@code capacitor://localhost} on iOS,
 * {@code https://localhost} on Android via WebViewAssetLoader,
 * {@code ionic://localhost} on legacy iOS builds).
 *
 * <p>The allowlist stays an exact-match list (no wildcard): the preflight of a
 * listed native scheme echoes its own {@code Origin} plus the requested
 * headers/methods, and an arbitrary unknown origin is still rejected outright.
 * The explicit property list in {@code @TestPropertySource} keeps the scenario
 * deterministic regardless of the local {@code backend/.env} values.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200,capacitor://localhost,https://localhost,ionic://localhost")
class CorsNativeOriginsIT {

    @Autowired MockMvc mockMvc;

    @ParameterizedTest
    @ValueSource(strings = { "capacitor://localhost", "https://localhost", "ionic://localhost" })
    void permitsListedNativeCapacitorSchemesOnPreflight(String origin) throws Exception {
        mockMvc.perform(options("/api/usuarios/login")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString("PATCH")))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, "authorization"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_MAX_AGE, "3600"));
    }

    /** The Angular dev server keeps preflighting exactly as before the change. */
    @Test
    void stillGrantsTheWebDevServerOrigin() throws Exception {
        mockMvc.perform(options("/api/tecnicos/cercanos")
                        .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString("GET")));
    }

    @Test
    void rejectsAnUnknownOriginOnPreflight() throws Exception {
        mockMvc.perform(options("/api/usuarios/login")
                        .header(HttpHeaders.ORIGIN, "https://attacker.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
