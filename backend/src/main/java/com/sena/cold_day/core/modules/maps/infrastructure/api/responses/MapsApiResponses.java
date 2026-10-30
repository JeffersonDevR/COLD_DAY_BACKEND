package com.sena.cold_day.core.modules.maps.infrastructure.api.responses;

import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.Ruta;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;

/** Respuestas del controller Maps. */
public final class MapsApiResponses {

    private MapsApiResponses() {
    }

    public record EstadoApiResponse(boolean enabled, boolean configured, String language, String region) {
    }

    public record DireccionApiResponse(String direccionFormateada, double latitud, double longitud, String placeId) {
        public static DireccionApiResponse de(DireccionGeocodificada d) {
            return new DireccionApiResponse(d.direccionFormateada(), d.latitud(), d.longitud(), d.placeId());
        }
    }

    public record SugerenciaApiResponse(String descripcion, String placeId) {
        public static SugerenciaApiResponse de(SugerenciaDireccion s) {
            return new SugerenciaApiResponse(s.descripcion(), s.placeId());
        }
    }

    public record DistanciaApiResponse(double distanciaKm, double duracionMin, String distanciaTexto, String duracionTexto) {
        public static DistanciaApiResponse de(RutaCalculada r) {
            return new DistanciaApiResponse(r.distanciaKm(), r.duracionMin(), r.distanciaTexto(), r.duracionTexto());
        }
    }

    /**
     * Ruta real por calles: distancia, ETA y el polyline codificado. Es el
     * contrato que consume el mapa de seguimiento para dibujar la calle; el
     * payload crudo de Google ({@code routes}, {@code legs}, {@code copyrights})
     * nunca sale del backend.
     */
    public record RutaApiResponse(double distanciaKm, double duracionMin, String polyline) {
        public static RutaApiResponse de(Ruta r) {
            return new RutaApiResponse(r.distanciaKm(), r.duracionMin(), r.polyline());
        }
    }

    /**
     * Map view configuration served to the frontend (GET /api/config/maps).
     * Mirrors the Google Maps shapes ({@code LatLngLiteral} and
     * {@code LatLngBoundsLiteral}) so the frontend can hand them straight to the
     * map component.
     */
    public record ConfigMapaApiResponse(String apiKey, CentroApiResponse centro, BoundsApiResponse bounds, double zoom,
            double radioInicialKm, double radioMaxKm, double radioPasoKm) {
    }

    /** Center of the map view (mirrors the Google Maps {@code LatLngLiteral}). */
    public record CentroApiResponse(double lat, double lng) {
    }

    /** Strict bounds of the map view (mirrors the Google Maps {@code LatLngBoundsLiteral}). */
    public record BoundsApiResponse(double north, double south, double east, double west) {
    }
}
