package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.Point;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * Coordinate payload for the location-capture endpoints. Bean validation
 * produces the deterministic 400 before {@link Point} is constructed; the
 * value object still enforces the same range at the domain boundary.
 */
public record UbicacionApiRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitud) {

    public Point toPoint() {
        return new Point(latitud, longitud);
    }
}
