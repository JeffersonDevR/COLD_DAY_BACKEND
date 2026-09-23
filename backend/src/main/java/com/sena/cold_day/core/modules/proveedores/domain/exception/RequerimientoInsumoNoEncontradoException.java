package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * The insumo request referenced by an offer does not exist. Mapped to HTTP 404
 * once the API surface exists (slice 11); it mirrors
 * {@code OtNoEncontradoException}.
 */
public class RequerimientoInsumoNoEncontradoException extends RuntimeException {

    public RequerimientoInsumoNoEncontradoException(RequerimientoInsumoId id) {
        super("No se encontro el requerimiento de insumos con identificador: " + id.valor());
    }
}
