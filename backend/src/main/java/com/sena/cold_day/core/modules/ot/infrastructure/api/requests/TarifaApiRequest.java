package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * Estimate payload: the destination the visit price is computed for. Bean
 * Validation produces the deterministic 400 for malformed input.
 */
public record TarifaApiRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitud) {
}
