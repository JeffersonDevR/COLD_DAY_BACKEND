package com.sena.cold_day.core.modules.ot.domain.exception;

/**
 * An insumo request cannot be located: neither the OT nor the assigned
 * technician has a stored location, so there is no delivery point to broadcast
 * around. Mapped to 422 and nothing is written.
 */
public class UbicacionDestinoInsumosException extends RuntimeException {

    public UbicacionDestinoInsumosException() {
        super("No se puede ubicar la entrega de los repuestos: la orden y el tecnico no tienen ubicacion");
    }
}
