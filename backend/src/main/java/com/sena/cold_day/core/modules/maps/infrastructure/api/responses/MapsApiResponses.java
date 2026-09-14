package com.sena.cold_day.core.modules.maps.infrastructure.api.responses;

import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
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
}
