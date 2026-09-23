package com.sena.cold_day.core.modules.proveedores.application.dto;

import java.time.Instant;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Flat view of a Proveedor exposed to the HTTP client. It carries the supplier's
 * business identity and the linked {@code usuarioId} but never credentials
 * (design: {@code ProveedorApiResponse} exposes no password).
 */
public record ProveedorResponse(
        ProveedorId id,
        Long usuarioId,
        String razonSocial,
        String nit,
        String telefono,
        boolean activo,
        Instant creadoEn) {

    public static ProveedorResponse from(Proveedor proveedor) {
        return new ProveedorResponse(proveedor.getId(), proveedor.getUsuarioId(), proveedor.getRazonSocial(),
                proveedor.getNit(), proveedor.getTelefono(), proveedor.isActivo(), proveedor.getCreadoEn());
    }
}
