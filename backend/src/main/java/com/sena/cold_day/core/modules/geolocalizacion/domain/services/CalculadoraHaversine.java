package com.sena.cold_day.core.modules.geolocalizacion.domain.services;

import com.sena.cold_day.core.shared.domain.Point;

/**
 * Pure Haversine distance calculation (RF-F1-07). No persistence, JPA or
 * PostGIS types: the spatial port is persistence-agnostic (design D9).
 */
public final class CalculadoraHaversine {

    /** Mean Earth radius in kilometres. */
    private static final double RADIO_TIERRA_KM = 6371.0;

    private CalculadoraHaversine() {
    }

    /**
     * Great-circle distance between two coordinates in kilometres.
     */
    public static double distanciaKm(Point origen, Point destino) {
        if (origen == null || destino == null) {
            throw new IllegalArgumentException("Los puntos de origen y destino son requeridos");
        }
        double latitudOrigen = Math.toRadians(origen.latitud());
        double latitudDestino = Math.toRadians(destino.latitud());
        double deltaLatitud = Math.toRadians(destino.latitud() - origen.latitud());
        double deltaLongitud = Math.toRadians(destino.longitud() - origen.longitud());

        double haversine = Math.pow(Math.sin(deltaLatitud / 2), 2)
                + Math.cos(latitudOrigen) * Math.cos(latitudDestino)
                        * Math.pow(Math.sin(deltaLongitud / 2), 2);

        double central = 2 * Math.asin(Math.min(1.0, Math.sqrt(haversine)));
        return RADIO_TIERRA_KM * central;
    }
}
