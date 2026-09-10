package com.sena.cold_day.core.modules.clientes.domain.exception;

public class ClienteSinDireccionException extends RuntimeException {
    public ClienteSinDireccionException() {
        super("El cliente no tiene una direccion principal configurada");
    }
}
