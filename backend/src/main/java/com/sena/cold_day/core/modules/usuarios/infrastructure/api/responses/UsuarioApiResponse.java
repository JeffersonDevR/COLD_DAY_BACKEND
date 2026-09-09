package com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses;

import java.time.LocalDateTime;

import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

public record UsuarioApiResponse(
        Long id,
        String nombre,
        String correo,
        String telefono,
        String fotoUrl,
        Rol rol,
        LocalDateTime fechaRegistro,
        boolean habeasDataAceptado,
        boolean activo) {

    public static UsuarioApiResponse from(UsuarioResponse response) {
        return new UsuarioApiResponse(response.id(), response.nombre(), response.correo(), response.telefono(),
                response.fotoUrl(), response.rol(), response.fechaRegistro(),
                response.habeasDataAceptado(), response.activo());
    }
}
