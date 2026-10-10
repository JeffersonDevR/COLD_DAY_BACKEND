package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Payload of the legacy generic registration endpoint {@code POST /api/usuarios}.
 * <p>
 * It deliberately has <b>no {@code rol} field</b>: this endpoint is
 * {@code permitAll}, so a client-supplied role would let anyone self-register as
 * {@code ADMINISTRADOR}. The role is now derived server-side with least
 * privilege ({@code Rol.CLIENTE}). Callers that legitimately need another role
 * must use the dedicated entry point for that role (for example
 * {@code POST /api/tecnicos} or {@code POST /api/clientes}).
 * <p>
 * A client still sending {@code "rol":"ADMINISTRADOR"} is not rejected: Jackson
 * is not configured with {@code FAIL_ON_UNKNOWN_PROPERTIES}, so the field is
 * silently ignored and the account is still created as {@code CLIENTE}. The
 * privilege escalation is therefore blocked, but the response gives the caller
 * no signal that the field was dropped.
 */
public record UsuarioApiRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank String password,
        String telefono,
        String fotoUrl,
        @NotNull Boolean aceptaHabeasData) {

    public UsuarioApiRequest {
        // Free-text normalization only: password stays byte-for-byte intact.
        nombre = TextoPlano.limpiar(nombre);
        correo = TextoPlano.limpiar(correo);
        telefono = TextoPlano.limpiar(telefono);
    }
}
