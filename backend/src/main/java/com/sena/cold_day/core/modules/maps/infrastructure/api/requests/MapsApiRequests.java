package com.sena.cold_day.core.modules.maps.infrastructure.api.requests;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Payloads del controller Maps. La validación Bean produce el 400 determinístico. */
public final class MapsApiRequests {

    private MapsApiRequests() {
    }

    public record GeocodeApiRequest(@NotBlank String direccion) {
    }

    public record DistanciaApiRequest(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double origenLat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double origenLng,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double destinoLat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double destinoLng) {
    }
}
