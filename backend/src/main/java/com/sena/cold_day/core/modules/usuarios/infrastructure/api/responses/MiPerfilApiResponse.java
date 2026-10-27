package com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses;

import com.sena.cold_day.core.modules.usuarios.application.dto.MiPerfilResponse;

/**
 * API view of {@code GET /api/usuarios/me}. {@code clientePerfilId},
 * {@code tecnicoPerfilId} and {@code proveedorPerfilId} serialized as strings
 * (scalar wire contract, null when the usuario has no such profile row yet).
 */
public record MiPerfilApiResponse(
        Long id,
        String nombre,
        String correo,
        String rol,
        java.util.List<String> roles,
        String clientePerfilId,
        String tecnicoPerfilId,
        String proveedorPerfilId) {

    public static MiPerfilApiResponse from(MiPerfilResponse response) {
        return new MiPerfilApiResponse(response.id(), response.nombre(), response.correo(), response.rol(),
                response.roles(), response.clientePerfilId(), response.tecnicoPerfilId(),
                response.proveedorPerfilId());
    }
}
