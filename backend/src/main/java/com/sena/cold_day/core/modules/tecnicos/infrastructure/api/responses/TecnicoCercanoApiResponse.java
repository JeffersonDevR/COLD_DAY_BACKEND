package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses;

import java.util.Set;

import com.sena.cold_day.core.modules.geolocalizacion.application.dto.TecnicoCercanoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/** API view of a nearby available technician for the client radar. */
public record TecnicoCercanoApiResponse(
        String id,
        String nombre,
        String telefono,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        double distanciaKm,
        double latitud,
        double longitud,
        boolean disponible) {

    public static TecnicoCercanoApiResponse from(TecnicoCercanoResponse response) {
        return new TecnicoCercanoApiResponse(
                response.id(),
                response.nombre(),
                response.telefono(),
                response.fotoUrl(),
                response.categoriasServicio(),
                response.distanciaKm(),
                response.latitud(),
                response.longitud(),
                response.disponible());
    }
}
