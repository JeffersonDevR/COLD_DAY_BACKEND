package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;

/**
 * Raised when an insumo-request transition is not part of the design state
 * machine. It mirrors {@code TransicionOtInvalidaException}; the REST advice
 * maps it to 409 once the API surface exists (slice 11).
 */
public class TransicionRequerimientoInvalidaException extends RuntimeException {

    public TransicionRequerimientoInvalidaException(EstadoRequerimiento origen, EstadoRequerimiento destino) {
        super("Transicion de requerimiento de insumo invalida: " + origen + " -> " + destino);
    }
}
