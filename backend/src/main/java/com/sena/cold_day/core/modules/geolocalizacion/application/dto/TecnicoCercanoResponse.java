package com.sena.cold_day.core.modules.geolocalizacion.application.dto;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * Vista de un técnico disponible dentro de un radio, lista para pintar el radar.
 * Combina la distancia calculada por el dominio de geolocalización con el perfil
 * del técnico y los datos de contacto de su usuario.
 */
public record TecnicoCercanoResponse(
        String id,
        String nombre,
        String telefono,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        double distanciaKm,
        double latitud,
        double longitud,
        boolean disponible) {
}
