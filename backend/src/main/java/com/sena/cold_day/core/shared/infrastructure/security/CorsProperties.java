package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * CORS configuration (prefix app.cors).
 * <ul>
 * <li>local/test: default {@code http://localhost:4200} (Angular dev server)
 * plus the Ionic/Capacitor native WebView schemes from
 * {@code application-dev.properties}</li>.
 * <li>prod ({@code application-prod.properties}): {@code CORS_ALLOWED_ORIGINS}
 * env var is mandatory (comma-separated exact origins, e.g.
 * {@code https://cold-day.onrender.com,capacitor://localhost}) — Spring fails at
 * startup if it is missing. Native app deployments must list their WebView
 * schemes there (default Capacitor 3+: {@code capacitor://localhost} on iOS
 * and {@code https://localhost} on Android; {@code ionic://localhost} covers
 * legacy Capacitor 2 iOS builds).</li>
 * </ul>
 * Origins are matched exactly (scheme + host + port, no trailing slash, case
 * insensitive). A custom scheme such as {@code capacitor://localhost} matches
 * the same exact rule as any web origin; no wildcard is ever accepted.
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
