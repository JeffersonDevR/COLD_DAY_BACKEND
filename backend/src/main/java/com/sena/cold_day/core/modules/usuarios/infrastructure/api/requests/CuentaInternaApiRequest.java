package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CuentaInternaApiRequest(
        @NotBlank @Size(max = 255) String nombre,
        @NotBlank @Email @Size(max = 255) String correo,
        @NotNull Rol rol) {

    public CuentaInternaApiRequest {
        nombre = TextoPlano.limpiar(nombre);
        correo = TextoPlano.limpiar(correo);
    }
}
