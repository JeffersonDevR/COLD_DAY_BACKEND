package com.sena.cold_day.core.modules.maps.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Payloads del controller Maps. La validación Bean produce el 400 determinístico. */
public final class MapsApiRequests {

    private MapsApiRequests() {
    }

    public record GeocodeApiRequest(@NotBlank String direccion) {

        public GeocodeApiRequest {
            direccion = TextoPlano.limpiar(direccion);
        }
    }

    public record DistanciaApiRequest(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double origenLat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double origenLng,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double destinoLat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double destinoLng) {
    }

    /** Un extremo de la ruta; los rangos coinciden con {@code Point}. */
    public record PuntoApiRequest(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double lng) {
    }

    /**
     * Payload de {@code POST /api/maps/ruta}: {@code {origen:{lat,lng},
     * destino:{lat,lng}}}. Se valida igual que el resto de endpoints de puntos,
     * y {@code @Valid} en los componentes propaga la validación a los extremos.
     */
    public record RutaApiRequest(@NotNull @Valid PuntoApiRequest origen, @NotNull @Valid PuntoApiRequest destino) {
    }
}
