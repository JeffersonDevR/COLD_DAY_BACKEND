package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;

public record DocumentoTecnicoApiRequest(
        @NotBlank String tipo,
        java.time.LocalDate fechaVencimiento) {
}
