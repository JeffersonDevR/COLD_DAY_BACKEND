package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import jakarta.validation.constraints.Min;

/**
 * Optional acceptance payload: the auxiliar count the technician declares when
 * taking the order. The body itself is optional (spec: Optional Auxiliar Count
 * at Acceptance), so an absent body or an omitted field means zero auxiliares.
 *
 * <p>{@code @Min(0)} rejects a negative count with the canonical 400. The
 * maximum is NOT {@code @Max} because it is configurable
 * ({@code app.auxiliares.max}); the use case enforces it against the injected
 * value (design AD4).
 */
public record AceptarOfertaApiRequest(
        @Min(value = 0, message = "no puede ser negativo") Integer auxiliaresRequeridos) {
}
