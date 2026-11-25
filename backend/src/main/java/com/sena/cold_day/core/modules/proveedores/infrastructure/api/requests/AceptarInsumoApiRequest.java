package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * The ETA, in minutes, the supplier commits to when it accepts. The upper bound
 * is configuration ({@code app.insumos.eta-maximo-minutos}), so the use case
 * enforces it; here only presence and a positive value are checked.
 */
public record AceptarInsumoApiRequest(@NotNull @Min(1) Integer etaMinutos) {
}
