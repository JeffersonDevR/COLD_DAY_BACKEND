package com.sena.cold_day.core.modules.maps.domain.services;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.Ruta;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;

/**
 * Puerto de salida hacia Google Maps Platform. La implementación vive en
 * infrastructure/google y es la única que conoce la server key.
 */
public interface MapsPort {

    Optional<DireccionGeocodificada> geocodificar(String direccion);

    Optional<DireccionGeocodificada> inversa(double latitud, double longitud);

    List<SugerenciaDireccion> autocompletar(String texto, Double sesgoLat, Double sesgoLng);

    Optional<RutaCalculada> distancia(double origenLat, double origenLng, double destinoLat, double destinoLng);

    /**
     * Ruta real por calles (Directions API). Devuelve {@code Optional.empty()}
     * cuando Google responde {@code ZERO_RESULTS}/{@code NOT_FOUND}, es decir
     * cuando no existe una ruta conduccible entre los dos puntos.
     */
    Optional<Ruta> ruta(double origenLat, double origenLng, double destinoLat, double destinoLng);
}
