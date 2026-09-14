package com.sena.cold_day.core.modules.maps.domain.model;

/**
 * Dirección normalizada devuelta por Google Geocoding.
 */
public record DireccionGeocodificada(String direccionFormateada, double latitud, double longitud, String placeId) {

    public DireccionGeocodificada {
        if (direccionFormateada == null || direccionFormateada.isBlank()) {
            throw new IllegalArgumentException("La dirección formateada no puede estar vacía");
        }
        if (latitud < -90 || latitud > 90) {
            throw new IllegalArgumentException("latitud fuera de rango");
        }
        if (longitud < -180 || longitud > 180) {
            throw new IllegalArgumentException("longitud fuera de rango");
        }
    }
}
