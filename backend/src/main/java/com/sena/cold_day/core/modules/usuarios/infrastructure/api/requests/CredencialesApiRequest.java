package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Credenciales de login. Deliberadamente SIN minimo: un minimo aqui rechazaria
 * con 400 la contrasena de una cuenta antigua creada antes de la politica, y
 * ademas confirmaria la politica al atacante. El maximo si se valida porque
 * BCrypt trunca en 72 bytes.
 */
public record CredencialesApiRequest(
        @NotBlank @Email String correo,
        @NotBlank @Size(max = 72) String password) {

    public CredencialesApiRequest {
        // password is intentionally NOT normalized.
        correo = TextoPlano.limpiar(correo);
    }
}
