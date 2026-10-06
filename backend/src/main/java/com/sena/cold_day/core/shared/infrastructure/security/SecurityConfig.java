package com.sena.cold_day.core.shared.infrastructure.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // habilita @PreAuthorize en los controllers
@EnableConfigurationProperties({ JwtProperties.class, CorsProperties.class, RateLimitProperties.class })
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final Optional<DevAuthBypassFilter> devBypassFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, Optional<DevAuthBypassFilter> devBypassFilter,
            RateLimitFilter rateLimitFilter) {
        this.jwtFilter = jwtFilter;
        this.devBypassFilter = devBypassFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
            tools.jackson.databind.ObjectMapper objectMapper) {
        try {
            http
                    // Stateless JWT API sin cookies ni sesiones: CSRF no aplica.
                    // Seguro deshabilitarlo aqui porque la autenticacion viaja en
                    // el header Authorization Bearer y SessionCreationPolicy.STATELESS.
                    .csrf(AbstractHttpConfigurer::disable) // NOSONAR: API stateless con JWT en header Authorization, sin cookies de sesion que proteger.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Usa el bean CorsConfigurationSource; responde el preflight OPTIONS
                // antes de exigir JWT.
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        // Preserve the original API status/body when Spring forwards a
                        // handled 404 (e.g. a technician has not reported a location yet)
                        // through the servlet ERROR dispatcher. Requiring a JWT again on
                        // that internal dispatch turns the expected 404 into a misleading 401.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        // Health check publico para la plataforma de despliegue (Render).
                        .requestMatchers("/actuator/health", "/actuator/health/**")
                        .permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**")
                        .permitAll()
                        // Registro publico: cada uno crea su propia cuenta, ninguno
                        // alcanza datos de terceros. El rol SIEMPRE lo deriva el
                        // servidor (Rol.TECNICO / CLIENTE / PROVEEDOR dentro del
                        // caso de uso); ningun request acepta un "rol" del cuerpo.
                        // POST /api/proveedores es el mismo patron: el proveedor se
                        // nace PENDIENTE y exigirValidado() sigue cerrando el paso
                        // a insumos hasta que un administrador lo apruebe.
                        .requestMatchers(HttpMethod.POST, "/api/usuarios", "/api/usuarios/login",
                                "/api/usuarios/recuperar-contrasena", "/api/usuarios/reset-contrasena",
                                "/api/tecnicos", "/api/clientes", "/api/proveedores").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/tecnicos/*/validacion")
                        .hasRole("ADMINISTRADOR")
                        .requestMatchers("/api/admin/**").hasRole("ADMINISTRADOR")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                // Rate limit de los 4 endpoints publicos de auth: va antes del
                // JWT porque son permitAll y no hay autenticacion que evaluar,
                // y es exactamente donde el cupo debe cortar la peticion. Es un
                // bean @Component ademas de estar en la cadena; OncePerRequestFilter
                // evita que el auto-registro del contenedor lo ejecute dos veces.
                .addFilterBefore(rateLimitFilter, JwtAuthenticationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(noAutenticado(objectMapper))
                        .accessDeniedHandler(sinPermiso(objectMapper)));
            // Solo dev local (app.security.dev-bypass.enabled): va despues del JWT para que
            // un token valido siempre tenga prioridad.
            devBypassFilter.ifPresent(f -> http.addFilterAfter(f, JwtAuthenticationFilter.class));
            return http.build();
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo construir la cadena de filtros de seguridad", ex);
        }
    }

    /**
     * CORS solo para los origenes configurados (app.cors.allowed-origins). La
     * autenticacion viaja en el header Authorization (sin cookies), por eso no
     * se habilitan credenciales.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.allowedOrigins());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    private AuthenticationEntryPoint noAutenticado(tools.jackson.databind.ObjectMapper objectMapper) {
        return (HttpServletRequest req, HttpServletResponse res, AuthenticationException ex) ->
                escribirApiError(res, 401, "No autenticado", objectMapper);
    }

    private AccessDeniedHandler sinPermiso(tools.jackson.databind.ObjectMapper objectMapper) {
        return (HttpServletRequest req, HttpServletResponse res, AccessDeniedException ex) ->
                escribirApiError(res, 403, "No tiene permisos para esta operacion", objectMapper);
    }

    /** Reuses the canonical ApiError payload shape of core/shared/errors. */
    private void escribirApiError(HttpServletResponse res, int status, String mensaje,
            tools.jackson.databind.ObjectMapper objectMapper) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write(objectMapper.writeValueAsString(
                List.of(new com.sena.cold_day.core.shared.errors.ApiError(status, mensaje, List.of()))));
    }
}
