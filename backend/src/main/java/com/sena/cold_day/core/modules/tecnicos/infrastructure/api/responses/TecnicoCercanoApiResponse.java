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

    /**
     * Coordenadas con ~1 km de resolucion. El radar solo necesita posicionar un
     * marcador dentro de un radio de kilometros; publicar la posicion GPS exacta
     * del tecnico a cualquier cuenta (el alta de cliente es publica) permitia
     * reconstruir su ubicacion en vivo barriendo centros y radios. La posicion
     * exacta sigue disponible para los participantes de la OT a traves de
     * {@code GET /api/ot/{id}/tecnico-ubicacion}.
     */
    private static final int DECIMALES_COORDENADA = 2;

    public static TecnicoCercanoApiResponse from(TecnicoCercanoResponse response) {
        return new TecnicoCercanoApiResponse(
                response.id(),
                response.nombre(),
                response.telefono(),
                response.fotoUrl(),
                response.categoriasServicio(),
                response.distanciaKm(),
                redondear(response.latitud()),
                redondear(response.longitud()),
                response.disponible());
    }

    private static double redondear(double valor) {
        double factor = Math.pow(10, DECIMALES_COORDENADA);
        return Math.round(valor * factor) / factor;
    }
}
