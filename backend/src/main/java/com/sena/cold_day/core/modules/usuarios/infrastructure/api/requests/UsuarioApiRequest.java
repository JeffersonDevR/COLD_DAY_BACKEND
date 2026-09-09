package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UsuarioApiRequest(
        @NotBlank String nombre,
        @Email String correo,
        @NotBlank String password,
        String telefono,
        String fotoUrl,
        @NotNull Rol rol) {
}
