package com.sena.cold_day.core.modules.maps.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Google Maps Platform credentials and proxy behaviour (prefix {@code app.maps}).
 * The real key lives in {@code backend/.env} ({@code GOOGLE_MAPS_API_KEY}) or in
 * an environment variable; here there is only the mapping. Booting without a key
 * is allowed for quota-free development: the use cases raise
 * {@code MapsNoDisponibleException} and the controller answers 503 with an
 * actionable message.
 */
@ConfigurationProperties(prefix = "app.maps")
public record MapsProperties(String apiKey, boolean enabled, String language, String region, int timeoutMs) {

    public MapsProperties {
        if (language == null || language.isBlank()) {
            language = "es";
        }
        if (region == null || region.isBlank()) {
            region = "CO";
        }
        if (timeoutMs <= 0) {
            timeoutMs = 4000;
        }
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public boolean usable() {
        return enabled && configured();
    }
}
