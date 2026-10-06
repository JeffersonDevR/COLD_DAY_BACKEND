package com.sena.cold_day.core.shared.errors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.SQLTransientConnectionException;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.persistence.OptimisticLockException;

/**
 * Contrato del mapeo global de fallos de infraestructura. Se prueba con MockMvc
 * standalone para aislar el advice de los advices de modulo y no depender de
 * Docker: aqui solo importa que cada excepcion produzca el codigo honesto y que
 * el cuerpo no filtre detalle interno.
 *
 * <p>La precedencia entre este advice y los de modulo no se prueba aqui (un
 * standalone no tiene mas de un advice). @Order(LOWEST_PRECEDENCE) conserva los
 * advices de Cliente/Proveedor/Tecnico; la suite existente (UsuariosApiIT,
 * OtVisitaCalificacionIT, ClientesApiIT) es la que comprueba que no hay regresion.
 */
class GlobalControllerAdviceTest {

    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new DummyController())
            .setControllerAdvice(new GlobalControllerAdvice())
            .build();

    @Test
    void mapsJpaOptimisticLockToConflict() throws Exception {
        mockMvc.perform(get("/test/optimista-jpa"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void mapsSpringObjectOptimisticLockToConflict() throws Exception {
        mockMvc.perform(get("/test/optimista-spring"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void mapsDataIntegrityViolationToConflict() throws Exception {
        mockMvc.perform(get("/test/integridad"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void mapsPoolExhaustionToServiceUnavailableWithRetryAfter() throws Exception {
        mockMvc.perform(get("/test/sin-pool"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Retry-After", "5"))
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void mapsQueryTimeoutToGatewayTimeout() throws Exception {
        mockMvc.perform(get("/test/timeout"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.status").value(504));
    }

    @Test
    void mapsResourceFailureToServiceUnavailable() throws Exception {
        mockMvc.perform(get("/test/recurso-caido"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Retry-After", "5"))
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void mapsTransientConnectionFailureToServiceUnavailable() throws Exception {
        mockMvc.perform(get("/test/conexion-transitoria"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void doesNotLeakInfrastructureDetailInThe503Body() throws Exception {
        MvcResult result = mockMvc.perform(get("/test/sin-pool"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value(
                        "El servicio no puede atender la solicitud en este momento. Reintente en unos segundos."))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body)
                .doesNotContain("sena-internal-host")
                .doesNotContain("jdbc:postgresql")
                .doesNotContain("HikariPool");
    }

    @RestController
    static class DummyController {

        @GetMapping("/test/optimista-jpa")
        void optimistaJpa() {
            throw new OptimisticLockException("boom: version 3 != 4");
        }

        @GetMapping("/test/optimista-spring")
        void optimistaSpring() {
            throw new ObjectOptimisticLockingFailureException("OtJpaEntity", 42L);
        }

        @GetMapping("/test/integridad")
        void integridad() {
            throw new DataIntegrityViolationException("boom: constraint uk_ot_codigo");
        }

        @GetMapping("/test/sin-pool")
        void sinPool() {
            throw new CannotGetJdbcConnectionException("HikariPool-1 - Connection is not available, "
                    + "request timed out: jdbc:postgresql://sena-internal-host:5432/cold_day");
        }

        @GetMapping("/test/timeout")
        void timeout() {
            throw new QueryTimeoutException("boom: statement timeout after 30s");
        }

        @GetMapping("/test/recurso-caido")
        void recursoCaido() {
            throw new DataAccessResourceFailureException("boom: connection refused at sena-internal-host");
        }

        @GetMapping("/test/conexion-transitoria")
        void conexionTransitoria() throws SQLTransientConnectionException {
            throw new SQLTransientConnectionException("boom: connection is not available");
        }
    }
}
