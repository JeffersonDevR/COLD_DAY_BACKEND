package com.sena.cold_day.core.modules.proveedores.domain.exception;

/**
 * The acting supplier cannot take the insumo action: it has no linked Proveedor
 * account, it is inactive, or it does not hold the offer/request it is acting on
 * (spec disp.R3, design AD7). The REST advice maps it to HTTP 403 once the API
 * surface exists (slice 11) — an ineligible supplier MUST fail cleanly, never as
 * an unhandled 500.
 */
public class ProveedorNoElegibleException extends RuntimeException {

    public ProveedorNoElegibleException(Long usuarioId) {
        super("El proveedor no es elegible para despachar insumos: usuario=" + usuarioId);
    }
}
