package com.sena.cold_day.core.modules.clientes.domain.exception;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;

public class ClienteNoEncontradoException extends RuntimeException {
    public ClienteNoEncontradoException(ClienteId id) {
        super("No se encontro el clinete con identificaor: " + id.valor());
    }

    public ClienteNoEncontradoException(String mensaje){
        super(mensaje);
    }
}
