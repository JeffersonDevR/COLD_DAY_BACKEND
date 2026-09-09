package com.sena.cold_day.core.modules.usuarios.domain.exception;

/** Thrown when no usuario matches the requested id. */
public class UsuarioNoEncontradoException extends RuntimeException {

    public UsuarioNoEncontradoException(long id) {
        super("Usuario no encontrado: %d".formatted(id));
    }

    public UsuarioNoEncontradoException(String correo) {
        super("Usuario no encontrado: %s".formatted(correo));
    }
}
