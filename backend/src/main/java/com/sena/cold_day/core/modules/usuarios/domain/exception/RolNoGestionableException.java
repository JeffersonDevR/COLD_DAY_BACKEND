package com.sena.cold_day.core.modules.usuarios.domain.exception;

public class RolNoGestionableException extends RuntimeException {

    public RolNoGestionableException() {
        super("Ese rol no se puede crear desde el panel.");
    }
}
