package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration (prefix app.jwt). Never hardcode the secret — inject
 * JWT_SECRET env var in production.
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long expiracionMs) {
}
