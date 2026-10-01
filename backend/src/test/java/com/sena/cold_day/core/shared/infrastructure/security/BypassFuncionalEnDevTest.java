package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * The counterpart of {@link BypassDesactivadoEnProdTest}: the dev bypass is a real,
 * working convenience in local development. If this stops working, developers
 * silently start needing real tokens and the escape hatch rots away unnoticed.
 * <p>
 * The contract under test, as implemented by {@link DevAuthBypassFilter}:
 * <ul>
 * <li>no JWT and no {@code X-Dev-Usuario} header → runs as the default seeded
 * administrator;</li>
 * <li>no JWT and {@code X-Dev-Usuario: <correo>} → runs as exactly that user;</li>
 * <li>a valid JWT wins over the bypass (the filter is registered after
 * {@link JwtAuthenticationFilter}).</li>
 * </ul>
 * The effective identity is read from the {@link Authentication} the security
 * context actually carries into the controller, so the assertions are about the
 * role granted and not about a status code that could also come from elsewhere.
 */
@SpringBootTest(properties = {
        "app.security.dev-bypass.enabled=true",
        "app.security.dev-bypass.correo=admin@coldday.com.co",
        "app.seed.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class BypassFuncionalEnDevTest {

    /** Correo sembrado por DevDataSeeder con rol ADMINISTRADOR. */
    private static final String ADMIN = "admin@coldday.com.co";
    /** Correo sembrado por DevDataSeeder con rol CLIENTE. */
    private static final String CLIENTE = "cliente1@coldday.com.co";

    @Autowired ApplicationContext context;
    @Autowired MockMvc mockMvc;
    @Autowired UsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired IdentidadObservada identidadObservada;

    @BeforeEach
    void sembrarUsuariosDelBypass() {
        crearSiFalta(ADMIN, Rol.ADMINISTRADOR);
        crearSiFalta(CLIENTE, Rol.CLIENTE);
        identidadObservada.limpiar();
    }

    private void crearSiFalta(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        if (usuarioRepository.buscarPorCorreo(correo).isEmpty()) {
            usuarioRepository.save(
                    Usuario.registrar("Seed " + rol, correo, "secreto", null, null, rol, true, encoder));
        }
    }

    @Test
    @DisplayName("con perfil dev el bean DevAuthBypassFilter si existe")
    void elBypassExisteEnDev() {
        assertThat(context.getBeanNamesForType(DevAuthBypassFilter.class)).isNotEmpty();
    }

    @Test
    @DisplayName("sin JWT y sin header, la peticion se ejecuta como el admin por defecto")
    void sinHeaderSeEjecutaComoElAdminPorDefecto() throws Exception {
        int status = mockMvc.perform(get("/api/tecnicos"))
                .andReturn().getResponse().getStatus();

        assertThat(rolEjecutado())
                .as("sin JWT ni header el bypass debe autenticar como el correo por defecto")
                .isEqualTo(Rol.ADMINISTRADOR);
        assertThat(status)
                .as("GET /api/tecnicos exige ADMINISTRADOR: 200 prueba que la peticion fue atendida")
                .isEqualTo(200);
    }

    @Test
    @DisplayName("sin JWT, con X-Dev-Usuario, la peticion se ejecuta como ese usuario")
    void elHeaderDeBypassAtiendeLaPeticionComoEseUsuario() throws Exception {
        int status = mockMvc.perform(get("/api/tecnicos")
                        .header("X-Dev-Usuario", ADMIN))
                .andReturn().getResponse().getStatus();

        assertThat(rolEjecutado()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(status).as("el admin sembrado si alcanza GET /api/tecnicos").isEqualTo(200);
    }

    @Test
    @DisplayName("con X-Dev-Usuario de otro rol, el alcance se limita a ese rol")
    void elHeaderDeBypassCambiaElRolEfectivo() throws Exception {
        int status = mockMvc.perform(get("/api/tecnicos")
                        .header("X-Dev-Usuario", CLIENTE))
                .andReturn().getResponse().getStatus();

        assertThat(rolEjecutado())
                .as("el bypass debe adoptar el rol del correo del header, no el del admin por defecto")
                .isEqualTo(Rol.CLIENTE);
        assertThat(status)
                .as("GET /api/tecnicos exige ADMINISTRADOR: un CLIENTE autenticado debe recibir 403")
                .isEqualTo(403);
    }

    @Test
    @DisplayName("un JWT valido tiene prioridad sobre el bypass")
    void unJwtValidoGanaAlBypass() throws Exception {
        Long clienteId = usuarioRepository.buscarPorCorreo(CLIENTE).orElseThrow().getId();
        String jwt = tokenIssuer.emitir(new UsuarioId(clienteId), Rol.CLIENTE, 0).valor();

        int status = mockMvc.perform(get("/api/tecnicos")
                        .header("Authorization", "Bearer " + jwt)
                        .header("X-Dev-Usuario", ADMIN))
                .andReturn().getResponse().getStatus();

        assertThat(rolEjecutado())
                .as("el filtro de bypass va despues del del JWT: con token valido no debe tocar nada")
                .isEqualTo(Rol.CLIENTE);
        assertThat(status).isEqualTo(403);
    }

    private Rol rolEjecutado() {
        Authentication authentication = identidadObservada.ultima();
        assertThat(authentication)
                .as("el bypass debe haber dejado una Authentication en el contexto de seguridad")
                .isNotNull();
        return ((AuthenticatedUser) authentication.getPrincipal()).rol();
    }

    /**
     * Captures the {@link Authentication} the security context carries into the
     * controller, per request. Reading it from the request instead of asserting
     * only on status codes is what makes "runs as ADMINISTRADOR" vs "runs as
     * CLIENTE" observable instead of inferred.
     */
    static final class IdentidadObservada implements HandlerInterceptor {

        private final AtomicReference<Authentication> ultima = new AtomicReference<>();

        @Override
        public boolean preHandle(jakarta.servlet.http.HttpServletRequest request,
                jakarta.servlet.http.HttpServletResponse response, Object handler) {
            ultima.set(SecurityContextHolder.getContext().getAuthentication());
            return true;
        }

        Authentication ultima() {
            return ultima.get();
        }

        void limpiar() {
            ultima.set(null);
        }
    }

    @TestConfiguration
    static class RegistroInterceptor implements WebMvcConfigurer {

        private final IdentidadObservada identidadObservada;

        RegistroInterceptor(IdentidadObservada identidadObservada) {
            this.identidadObservada = identidadObservada;
        }

        @Bean
        static IdentidadObservada identidadObservada() {
            return new IdentidadObservada();
        }

        @Override
        public void addInterceptors(InterceptorRegistry registry) {
            registry.addInterceptor(identidadObservada).addPathPatterns("/api/**");
        }
    }
}