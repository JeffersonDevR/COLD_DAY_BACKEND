package com.sena.cold_day.core.modules.maps.domain.model;

/** Resultado de Distance Matrix: distancia vial + duración estimada. */
public record RutaCalculada(double distanciaKm, double duracionMin, String distanciaTexto, String duracionTexto) {

    public RutaCalculada {
        if (distanciaKm < 0) {
            throw new IllegalArgumentException("La distancia no puede ser negativa");
        }
        if (duracionMin < 0) {
            throw new IllegalArgumentException("La duración no puede ser negativa");
        }
    }
}
