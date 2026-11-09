package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Reset de contrasena. El maximo de 72 bytes no es arbitrario: BCrypt trunca en
 * ese punto, asi que una contrasena mas larga se acepta pero solo sus primeros 72
 * bytes cuentan (dos contrasenas distintas pasarian a ser equivalentes).
 */
public record RestablecerContrasenaApiRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 8, max = 72) String nuevaPassword) {
}
