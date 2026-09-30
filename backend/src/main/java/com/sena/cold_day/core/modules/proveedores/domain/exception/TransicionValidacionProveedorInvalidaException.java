package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;

/**
 * Raised when a supplier-validation transition is not part of the design state
 * machine declared in {@code TransicionesProveedor}. It mirrors
 * {@link TransicionRequerimientoInvalidaException} in the same module; the REST
 * advice maps it to 409.
 */
public class TransicionValidacionProveedorInvalidaException extends RuntimeException {

    public TransicionValidacionProveedorInvalidaException(EstadoValidacionProveedor origen,
            EstadoValidacionProveedor destino) {
        super("Transicion de validacion de proveedor invalida: " + origen + " -> " + destino);
    }
}
