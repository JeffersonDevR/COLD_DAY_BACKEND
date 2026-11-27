package com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;

public record CuentaApiResponse(Long id, String nombre, String correo, String rol, boolean activa) {

    public static CuentaApiResponse from(Usuario usuario) {
        return new CuentaApiResponse(usuario.getId(), usuario.getNombre(), usuario.getCorreo(),
                usuario.getRol().name(), usuario.isActivo());
    }
}
