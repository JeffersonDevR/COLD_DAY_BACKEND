package com.sena.cold_day.core.modules.usuarios.application.dto;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

public record UsuarioResponse(
        Long id,
        String nombre,
        String correo,
        String telefono,
        String fotoUrl,
        Rol rol,
        Instant fechaRegistro,
        boolean habeasDataAceptado,
        boolean activo) {
}
