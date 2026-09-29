package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * CORS configuration (prefix app.cors).
 * <ul>
 * <li>local/test: default {@code http://localhost:4200} (Angular dev server)
 * from {@code application.properties}.</li>
 * <li>prod ({@code application-prod.properties}): {@code CORS_ALLOWED_ORIGINS}
 * env var is mandatory (comma-separated exact origins, e.g.
 * {@code https://cold-day.onrender.com}) — Spring fails at startup if it is
 * missing.</li>
 * </ul>
 * Origins are matched exactly (scheme + host + port, no trailing slash).
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of()
                : allowedOrigins.stream().map(String::trim).filter(o -> !o.isEmpty()).toList();
        // El binder de @ConfigurationProperties deja literal un placeholder sin
        // resolver (no lanza como @Value), asi que se valida aqui para fallar
        // rapido en el arranque si CORS_ALLOWED_ORIGINS falta o esta vacia.
        if (allowedOrigins.isEmpty() || allowedOrigins.stream().anyMatch(o -> o.contains("${"))) {
            throw new IllegalStateException(
                    "CORS sin origenes validos: define la variable de entorno CORS_ALLOWED_ORIGINS "
                            + "(origenes separados por coma). Ver application-prod.properties.");
        }
    }
}
