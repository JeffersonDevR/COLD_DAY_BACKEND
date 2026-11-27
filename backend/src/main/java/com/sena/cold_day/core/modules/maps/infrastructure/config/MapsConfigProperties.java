package com.sena.cold_day.core.modules.maps.infrastructure.config;

import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Map view configuration served to the frontend (prefix {@code app.maps}, the
 * same prefix as {@link MapsProperties}: it only binds the keys it declares).
 *
 * <p>The center, the metropolitan bounds, the zoom and the radius ladder are the
 * single source of truth for the map view: the frontend reads them from
 * {@code GET /api/config/maps} instead of duplicating the literals. The server
 * key is never part of that response; {@code browserApiKey} is the only
 * credential the frontend may read (it is restricted by HTTP referrer).
 *
 * <p>{@code proveedor} tells the frontend which map engine to load
 * ({@code google} by default). It is normalized to lower case; the frontend
 * falls back to Google for any value it does not know, so an unknown name never
 * leaves the app without a map.
 */
@ConfigurationProperties(prefix = "app.maps")
public record MapsConfigProperties(String browserApiKey, double centroLat, double centroLng, double boundsNorth,
        double boundsSouth, double boundsWest, double boundsEast, double zoom, double radioInicialKm,
        double radioMaxKm, double radioPasoKm, String proveedor) {

    /** Map engine used when {@code app.maps.proveedor} is missing or blank. */
    public static final String PROVEEDOR_POR_DEFECTO = "google";

    public MapsConfigProperties {
        if (browserApiKey != null && browserApiKey.isBlank()) {
            browserApiKey = null;
        }
        if (centroLat == 0) {
            centroLat = 7.8939;
        }
        if (centroLng == 0) {
            centroLng = -72.5078;
        }
        if (boundsNorth == 0) {
            boundsNorth = 8.08;
        }
        if (boundsSouth == 0) {
            boundsSouth = 7.76;
        }
        if (boundsWest == 0) {
            boundsWest = -72.6;
        }
        if (boundsEast == 0) {
            boundsEast = -72.41;
        }
        if (zoom == 0) {
            zoom = 13;
        }
        if (radioInicialKm <= 0) {
            radioInicialKm = 10;
        }
        if (radioMaxKm <= 0) {
            radioMaxKm = 25;
        }
        if (radioPasoKm <= 0) {
            radioPasoKm = 5;
        }
        proveedor = proveedor == null || proveedor.isBlank()
                ? PROVEEDOR_POR_DEFECTO
                : proveedor.trim().toLowerCase(Locale.ROOT);
    }
}
