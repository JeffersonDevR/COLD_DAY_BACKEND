package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body de {@code POST /api/solicitudes-perfil}: perfil deseado y motivacion. */
public record SolicitudPerfilApiRequest(
        @NotNull Rol perfilDeseado,
        @NotBlank @Size(max = 1000) String motivacion) {

    public SolicitudPerfilApiRequest {
        motivacion = TextoPlano.limpiar(motivacion);
    }
}
