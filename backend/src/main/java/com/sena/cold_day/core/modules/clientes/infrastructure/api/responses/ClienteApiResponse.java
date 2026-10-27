package com.sena.cold_day.core.modules.clientes.infrastructure.api.responses;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;

/**
 * API view of a client profile. {@code id} is a plain UUID string (the domain
 * {@code ClienteId} record would otherwise serialize as an object) and
 * {@code usuarioId} is the scalar usuario identifier.
 *
 * <p>{@code token} is additive and only present on the second-profile
 * acquisition response: that call revokes the caller's previous token, so it
 * hands back the replacement. Every other read keeps the original wire shape
 * because a null token is omitted.
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
        boolean activo,
        @JsonInclude(JsonInclude.Include.NON_NULL) String token) {

    public static ClienteApiResponse from(ClienteResponse response) {
        return conToken(response, null);
    }

    public static ClienteApiResponse conToken(ClienteResponse response, String token) {
        return new ClienteApiResponse(String.valueOf(response.id().valor()), response.usuarioId().valor(),
                response.nombre(), response.correo(), response.telefono(), response.fotoUrl(),
                response.tipoCliente(), response.direccion(), response.activo(), token);
    }
}
