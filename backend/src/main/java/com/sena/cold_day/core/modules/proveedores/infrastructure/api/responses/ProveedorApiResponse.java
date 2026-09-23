package com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;

/**
 * API view of a supplier. {@code id} is a plain UUID string so the wire contract
 * stays scalar (the domain {@code ProveedorId} record would otherwise serialize
 * as an object), mirroring {@code TecnicoApiResponse}. No credentials are
 * exposed.
 */
public record ProveedorApiResponse(String id, Long usuarioId, String razonSocial, String nit,
        String telefono, boolean activo, String creadoEn) {

    public static ProveedorApiResponse from(ProveedorResponse response) {
        return new ProveedorApiResponse(String.valueOf(response.id()), response.usuarioId(), response.razonSocial(),
                response.nit(), response.telefono(), response.activo(),
                response.creadoEn() == null ? null : response.creadoEn().toString());
    }
}
