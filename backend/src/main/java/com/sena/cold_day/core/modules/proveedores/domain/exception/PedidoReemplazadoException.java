package com.sena.cold_day.core.modules.proveedores.domain.exception;

/** The technician moved the request to another supplier: this one can no longer act on it. 409. */
public class PedidoReemplazadoException extends RuntimeException {

    public PedidoReemplazadoException() {
        super("Este pedido ya no es tuyo");
    }
}
