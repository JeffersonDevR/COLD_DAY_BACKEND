package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RecuperarContrasenaApiRequest(
        @NotBlank @Email String correo) {

    public RecuperarContrasenaApiRequest {
        correo = TextoPlano.limpiar(correo);
    }
}
