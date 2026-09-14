package com.sena.cold_day.core.modules.maps.domain.model;

/** Sugerencia de Places Autocomplete (sin exponer la key al navegador). */
public record SugerenciaDireccion(String descripcion, String placeId) {

    public SugerenciaDireccion {
        if (descripcion == null || descripcion.isBlank()) {
            throw new IllegalArgumentException("La descripción no puede estar vacía");
        }
    }
}
