package com.sena.cold_day.core.modules.maps.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración Google Maps Platform (prefijo app.maps).
 * La clave real vive en backend/.env (GOOGLE_MAPS_API_KEY) o como variable
 * de entorno; aquí solo el mapeo. Se permite arrancar sin clave para
 * desarrollo sin cuota: los casos de uso lanzan MapsNoDisponibleException
 * y el controller responde 503 con un mensaje accionable.
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
