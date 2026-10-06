package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Unit tests del {@link RateLimitFilter} sin Spring ni Docker: se ejercita el
 * filtro con {@code MockHttpServletRequest}/{@code MockHttpServletResponse} y
 * una cadena simple que registra si llego a ejecutarse.
 * <p>
 * Cada test construye su propio filtro y usa su propia IP remota; aun asi se
 * respeta la disciplina de aislamiento por {@code setRemoteAddr(...)} en vez de
 * {@code X-Forwarded-For}, porque el filtro ignora ese header a proposito.
 */
class RateLimitFilterTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder().build();
    private static final String LOGIN = "/api/usuarios/login";

    @Test
    void unaRutaNoAuthPasaSinConsumirElCupo() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(true, 2, 60), MAPPER);
        String ip = "10.10.0.1";

        // GET /api/usuarios no es una de las rutas limitadas: pasa intacto.
        ChainStub getChain = new ChainStub();
        filter.doFilter(request("GET", "/api/usuarios", ip), new MockHttpServletResponse(), getChain);
        assertThat(getChain.invoked).isTrue();

        // Dos POST /login desde la misma IP siguen pasando: el GET previo no
        // consumio cupo (cupo = 2).
        for (int intento = 1; intento <= 2; intento++) {
            ChainStub postChain = new ChainStub();
            filter.doFilter(request("POST", LOGIN, ip), new MockHttpServletResponse(), postChain);
            assertThat(postChain.invoked).as("intento %d dentro del cupo", intento).isTrue();
        }
    }

    @Test
    void conHabilitadoFalsePasaAunqueSeSupereElCupo() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(false, 1, 60), MAPPER);
        String ip = "10.10.0.2";

        for (int intento = 1; intento <= 3; intento++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            ChainStub chain = new ChainStub();
            filter.doFilter(request("POST", LOGIN, ip), response, chain);
            assertThat(chain.invoked).as("habilitado=false nunca corta").isTrue();
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }

    @Test
    void alSuperarElCupoCortaCon429YRetryAfter() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(true, 2, 60), MAPPER);
        String ip = "10.10.0.3";

        for (int intento = 1; intento <= 2; intento++) {
            ChainStub chain = new ChainStub();
            filter.doFilter(request("POST", LOGIN, ip), new MockHttpServletResponse(), chain);
            assertThat(chain.invoked).as("intento %d dentro del cupo", intento).isTrue();
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        ChainStub beyond = new ChainStub();
        filter.doFilter(request("POST", LOGIN, ip), response, beyond);

        assertThat(beyond.invoked).as("el intento de mas no debe llegar al controller").isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isEqualTo("60");
        assertThat(response.getContentAsString())
                .contains("\"status\":429")
                .contains("Demasiadas solicitudes. Reintente mas tarde.");
    }

    private static MockHttpServletRequest request(String method, String path, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    /** Cadena que solo registra si fue invocada. */
    private static final class ChainStub implements FilterChain {

        private boolean invoked;

        @Override
        public void doFilter(ServletRequest request, ServletResponse response) {
            this.invoked = true;
        }
    }
}
