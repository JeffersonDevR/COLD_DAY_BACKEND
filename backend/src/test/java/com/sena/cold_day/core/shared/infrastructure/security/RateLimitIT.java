package com.sena.cold_day.core.shared.infrastructure.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * IT del rate limit de los endpoints publicos de auth. Cupo bajo y fijo
 * (max-intentos=3, ventana=60s) para que el limite sea determinista.
 * <p>
 * <b>Aislamiento:</b> el limiter es en memoria y el contexto de Spring queda
 * cacheado entre metodos de test (LimpiezaBaseDatosListener solo trunca la
 * base), asi que los contadores sobreviven. Cada metodo usa su PROPIA IP
 * remota con {@code request.setRemoteAddr(...)}; NO se usa
 * {@code X-Forwarded-For} porque el filtro lo ignora a proposito (seria
 * falsificable).
 */
@SpringBootTest(properties = {
        "app.rate-limit.auth.max-intentos=3",
        "app.rate-limit.auth.ventana-segundos=60" })
@AutoConfigureMockMvc
class RateLimitIT {

    private static final String LOGIN = "/api/usuarios/login";
    private static final String RECUPERAR = "/api/usuarios/recuperar-contrasena";
    private static final String CREDENCIALES_MALAS =
            "{\"correo\":\"nadie@example.com\",\"password\":\"mal\"}";

    @Autowired MockMvc mockMvc;

    private static RequestPostProcessor desde(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    @Test
    void loginSeLimitaTrasLosIntentosPermitidosYDevuelveRetryAfter() throws Exception {
        String ip = "10.9.9.1";

        // Los primeros max-intentos (3) pasan y fallan por credenciales -> 401.
        for (int intento = 1; intento <= 3; intento++) {
            mockMvc.perform(post(LOGIN).with(desde(ip)).contentType(MediaType.APPLICATION_JSON)
                    .content(CREDENCIALES_MALAS))
                    .andExpect(status().isUnauthorized());
        }

        // El cuarto supera el cupo -> 429 + Retry-After + shape de seguridad.
        mockMvc.perform(post(LOGIN).with(desde(ip)).contentType(MediaType.APPLICATION_JSON)
                .content(CREDENCIALES_MALAS))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$[0].status").value(429))
                .andExpect(jsonPath("$[0].message").value("Demasiadas solicitudes. Reintente mas tarde."));
    }

    @Test
    void agotarLoginNoBloqueaRecuperacionDesdeLaMismaIP() throws Exception {
        String ip = "10.9.9.2";

        for (int intento = 1; intento <= 3; intento++) {
            mockMvc.perform(post(LOGIN).with(desde(ip)).contentType(MediaType.APPLICATION_JSON)
                    .content(CREDENCIALES_MALAS))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post(LOGIN).with(desde(ip)).contentType(MediaType.APPLICATION_JSON)
                .content(CREDENCIALES_MALAS))
                .andExpect(status().isTooManyRequests());

        // Misma IP, OTRA ruta de auth: su bucket arranca de cero -> 202.
        mockMvc.perform(post(RECUPERAR).with(desde(ip)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"nadie@example.com\"}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void unaRutaNoAuthNoSeLimitaNuncaAHaberCupo() throws Exception {
        String ip = "10.9.9.3";

        // GET /api/usuarios no esta limitado: seis intentos sin token siguen
        // devolviendo el 401 normal de la capa de seguridad, nunca 429.
        for (int intento = 1; intento <= 6; intento++) {
            mockMvc.perform(get("/api/usuarios").with(desde(ip)))
                    .andExpect(status().isUnauthorized());
        }
    }
}
