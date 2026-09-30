package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Thrown when a supplier has no documents at all, or when at least one of them
 * is already expired, so the administrator cannot approve its documentation.
 * Mirrors the {@code tecnicos} {@code DocumentacionIncompletaException}; the
 * REST advice maps it to 400.
 */
public class DocumentacionProveedorIncompletaException extends RuntimeException {

    public DocumentacionProveedorIncompletaException(ProveedorId proveedorId) {
        super("Documentacion incompleta o vencida del proveedor %s".formatted(proveedorId));
    }
}
