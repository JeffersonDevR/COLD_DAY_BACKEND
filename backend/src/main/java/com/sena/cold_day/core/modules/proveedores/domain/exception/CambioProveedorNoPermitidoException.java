package com.sena.cold_day.core.modules.proveedores.domain.exception;

/** The request cannot be taken away from its supplier (dispatched, or the ETA has not elapsed). 409. */
public class CambioProveedorNoPermitidoException extends RuntimeException {

    public CambioProveedorNoPermitidoException(String motivo) {
        super(motivo);
    }
}
