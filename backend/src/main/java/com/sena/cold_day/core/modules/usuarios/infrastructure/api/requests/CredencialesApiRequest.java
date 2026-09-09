package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CredencialesApiRequest(
        @NotBlank @Email String correo,
        @NotBlank String password) {
}
