package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Rate limit de los endpoints publicos de autenticacion (prefijo
 * {@code app.rate-limit.auth}), consumido por {@link RateLimitFilter}.
 * <p>
 * Los valores por defecto viven en {@code application.properties} y son
 * sobrescribibles por variable de entorno ({@code RATE_LIMIT_AUTH_ENABLED},
 * {@code RATE_LIMIT_AUTH_MAX}, {@code RATE_LIMIT_AUTH_WINDOW}), en el mismo
 * estilo que {@code app.maps.*}.
 * <p>
 * La ventana se mide en segundos y el cupo por IP+ruta. El constructor rechaza
 * valores {@code <= 0}: un cupo o una ventana no positivos son una
 * configuracion invalida, no un "sin limite" silencioso.
 * <p>
 * {@code habilitado} tiene {@code @DefaultValue("true")} a proposito: si la
 * clave falta, el cupo debe quedar ACTIVO (default seguro), nunca apagarse en
 * silencio. Los dos enteros NO tienen default para que una configuracion
 * parcial falle ruidosamente al arrancar en vez de degradar el limite.
 */
@ConfigurationProperties(prefix = "app.rate-limit.auth")
public record RateLimitProperties(@DefaultValue("true") boolean habilitado, int maxIntentos,
        int ventanaSegundos) {

    public RateLimitProperties {
        if (maxIntentos <= 0) {
            throw new IllegalStateException(
                    "app.rate-limit.auth.max-intentos debe ser > 0 (recibido " + maxIntentos + ").");
        }
        if (ventanaSegundos <= 0) {
            throw new IllegalStateException(
                    "app.rate-limit.auth.ventana-segundos debe ser > 0 (recibido " + ventanaSegundos + ").");
        }
    }
}
