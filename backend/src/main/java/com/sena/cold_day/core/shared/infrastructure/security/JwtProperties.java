package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration (prefix app.jwt). Never hardcode the secret:
 * <ul>
 * <li>local/test: dev default from {@code application.properties}.</li>
 * <li>prod ({@code application-prod.properties}): {@code JWT_SECRET} env var is
 * mandatory — Spring fails at startup if it is missing.</li>
 * </ul>
 * As a last line of defense this record also rejects blank or short secrets
 * in every environment (HS256 needs at least 32 bytes / 256 bits).
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long expiracionMs) {

    /** Visible for the prod-profile guard; do not use as a real secret. */
    public static final String DEV_DEFAULT_SECRET = "cold-day-dev-secret-key-change-me-32-bytes !!";

    public JwtProperties {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT secret ausente: define la variable de entorno JWT_SECRET "
                            + "(minimo 32 bytes). Ver application-prod.properties.");
        }
        if (secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "JWT secret demasiado corto: HS256 exige minimo 32 bytes (256 bits).");
        }
    }
}
