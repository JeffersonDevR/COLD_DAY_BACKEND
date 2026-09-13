package com.sena.cold_day.core.modules.clientes.infrastructure.api.responses;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;

/**
 * API view of a client profile. {@code id} is a plain UUID string (the domain
 * {@code ClienteId} record would otherwise serialize as an object) and
 * {@code usuarioId} is the scalar usuario identifier.
 */
public record ClienteApiResponse(
        String id,
        Long usuarioId,
        String nombre,
        String correo,
        String telefono,
        String fotoUrl,
        TipoCliente tipoCliente,
        DireccionPrincipal direccion,
        boolean activo) {

    public static ClienteApiResponse from(ClienteResponse response) {
        return new ClienteApiResponse(String.valueOf(response.id().valor()), response.usuarioId().valor(),
                response.nombre(), response.correo(), response.telefono(), response.fotoUrl(),
                response.tipoCliente(), response.direccion(), response.activo());
    }
}
