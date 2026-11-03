package com.sena.cold_day.core.modules.maps.domain.model;

/**
 * Ruta real por calles (Directions API): distancia vial, duración estimada y
 * el polyline codificado que el mapa dibuja. A diferencia de
 * {@link RutaCalculada}, que solo transporta números, esta incluye la geometría:
 * el frontend la decodifica en el cliente, el backend nunca la dibuja.
 */
public record Ruta(double distanciaKm, double duracionMin, String polyline) {

    /**
     * Única modalidad soportada. Es parte de la clave de cache para que una
     * futura ruta a pie o en bici no reutilice una respuesta de conducción.
     */
    public static final String MODO_CONDUCCION = "driving";

    public Ruta {
        if (distanciaKm < 0) {
            throw new IllegalArgumentException("La distancia no puede ser negativa");
        }
        if (duracionMin < 0) {
            throw new IllegalArgumentException("La duración no puede ser negativa");
        }
        if (polyline == null) {
            polyline = "";
        }
    }
}
