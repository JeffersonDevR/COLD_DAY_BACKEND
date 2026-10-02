package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;

public record PagarVisitaApiRequest(@NotBlank String medioPago) {
}
