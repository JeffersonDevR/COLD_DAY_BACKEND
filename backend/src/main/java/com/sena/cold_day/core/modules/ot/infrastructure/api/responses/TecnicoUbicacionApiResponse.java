package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import com.sena.cold_day.core.shared.domain.Point;

/**
 * Last known location of the technician assigned to an OT, used by the client
 * view to compute live distance/ETA.
 */
public record TecnicoUbicacionApiResponse(Double latitud, Double longitud) {

    public static TecnicoUbicacionApiResponse de(Point ubicacion) {
        return new TecnicoUbicacionApiResponse(ubicacion.latitud(), ubicacion.longitud());
    }
}
