package com.sena.cold_day.core.shared.infrastructure.security;

import java.io.IOException;
import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // habilita @PreAuthorize en los controllers
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
            tools.jackson.databind.ObjectMapper objectMapper) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/usuarios", "/api/usuarios/login",
                                "/api/usuarios/recuperar-contrasena", "/api/tecnicos").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/tecnicos/*/validacion")
                        .hasRole("ADMINISTRADOR")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(noAutenticado(objectMapper))
                        .accessDeniedHandler(sinPermiso(objectMapper)));
        return http.build();
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
