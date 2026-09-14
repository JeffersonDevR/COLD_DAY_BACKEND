package com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Projection returned by the spatial availability port: an eligible technician
 * and its distance to the search centre in kilometres. Only value objects cross
 * the port boundary (design D9).
 */
public record TecnicoCercano(TecnicoId tecnicoId, double distanciaKm) {

    public TecnicoCercano {
        if (tecnicoId == null) {
            throw new IllegalArgumentException("El tecnico es requerido");
        }
        if (distanciaKm < 0) {
            throw new IllegalArgumentException("La distancia no puede ser negativa");
        }
    }
}
