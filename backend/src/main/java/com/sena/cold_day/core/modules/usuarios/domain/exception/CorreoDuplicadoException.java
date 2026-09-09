package com.sena.cold_day.core.modules.usuarios.domain.exception;

/**
 * Thrown when the correo is already taken. Uniqueness is validated in the
 * use case first and reinforced by the UNIQUE constraint in the database.
 */
public class CorreoDuplicadoException extends RuntimeException {

    public CorreoDuplicadoException(String correo) {
        super("Correo duplicado: %s".formatted(correo));
    }
}
