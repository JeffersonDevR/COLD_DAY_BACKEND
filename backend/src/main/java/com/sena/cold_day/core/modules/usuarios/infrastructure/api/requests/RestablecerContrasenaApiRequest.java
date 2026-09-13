package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;

public record RestablecerContrasenaApiRequest(
        @NotBlank String token,
        @NotBlank String nuevaPassword) {
}
