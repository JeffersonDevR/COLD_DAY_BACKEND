package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.ColdDayApplication;

/**
 * The dev bypass must not exist in production.
 * <p>
 * {@code application-prod.properties} is loaded for real (no mocked
 * {@link Environment}): the datasource still comes from Testcontainers through
 * {@code PostgisContainerInitializer}, but every security-relevant property comes
 * from the prod profile.
 * <p>
 * Two guarantees are asserted, and they are not the same one:
 * <ol>
 * <li>with prod active and the bypass property absent, the
 * {@code @ConditionalOnProperty} gate keeps {@link DevAuthBypassFilter} out of the
 * context and an unauthenticated request still gets 401;</li>
 * <li>with prod active and the bypass property explicitly forced to
 * {@code true}, the application refuses to start. The constructor guard in
 * {@link DevAuthBypassFilter} aborts the boot on purpose, so the bypass can never
 * reach a running production context even when the property is misconfigured —
 * that is a stronger guarantee than "the bean is simply absent", and it is the
 * behaviour the filter actually implements.</li>
 * </ol>
 * The profile is never simulated with a mock in either case.
 */
@SpringBootTest(properties = {
        "app.jwt.secret=prod-contract-secret-of-at-least-32-bytes",
        "app.cors.allowed-origins=https://cold-day.onrender.com",
        "app.seed.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class BypassDesactivadoEnProdTest {

    @Autowired ApplicationContext context;
    @Autowired MockMvc mockMvc;

    @Test
    @DisplayName("el perfil prod no crea el bean DevAuthBypassFilter")
    void elBypassNoExisteEnProd() {
        assertThat(context.getBeanNamesForType(DevAuthBypassFilter.class))
                .as("DevAuthBypassFilter no debe existir con el perfil prod activo")
                .isEmpty();
    }

    @Test
    @DisplayName("en prod una peticion sin token sigue respondiendo 401")
    void sinTokenSigueSiendo401EnProd() throws Exception {
        int status = mockMvc.perform(get("/api/tecnicos"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(401);
    }

    @Test
    @DisplayName("con prod activo, forzar el bypass a true impide que la aplicacion arranque")
    void elBypassActivoEnProdImpideElArranque() {
        assertThatThrownBy(() -> new SpringApplicationBuilder(ColdDayApplication.class)
                .web(WebApplicationType.SERVLET)
                .profiles("prod")
                .properties(
                        "app.jwt.secret=prod-contract-secret-of-at-least-32-bytes",
                        "app.cors.allowed-origins=https://cold-day.onrender.com",
                        "app.seed.enabled=false")
                // Command-line args outrank the JVM system properties the build sets,
                // so this is the only way to force the property ON in a prod boot.
                .run("--app.security.dev-bypass.enabled=true"))
                .rootCause()
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no esta permitido con el perfil prod");
    }
}