package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CredencialesApiRequest(
        @NotBlank @Email String correo,
        @NotBlank String password) {

    public CredencialesApiRequest {
        // password is intentionally NOT normalized.
        correo = TextoPlano.limpiar(correo);
    }
}
