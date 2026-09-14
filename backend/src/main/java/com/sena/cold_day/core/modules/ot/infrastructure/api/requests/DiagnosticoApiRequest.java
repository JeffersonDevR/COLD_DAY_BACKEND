package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Diagnosis + budget payload (RF-F1-11): the detected fault and the labor and
 * parts costs that make up the budget presented to the client.
 */
public record DiagnosticoApiRequest(
        @NotBlank @Size(max = 1000) String fallaDetectada,
        @Size(max = 1000) String observaciones,
        @NotNull @DecimalMin("0.0") BigDecimal costoManoObra,
        @NotNull @DecimalMin("0.0") BigDecimal costoRepuestos) {
}
