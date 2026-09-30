package com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses;

import java.time.LocalDate;

import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;

public record DocumentoProveedorApiResponse(Long id, String tipo, LocalDate fechaVencimiento) {

    public static DocumentoProveedorApiResponse from(DocumentoProveedor documento) {
        return new DocumentoProveedorApiResponse(documento.id(), documento.tipo(), documento.fechaVencimiento());
    }
}
