package com.sena.cold_day.core.modules.usuarios.domain.exception;

/**
 * Thrown when the correo is already taken. Uniqueness is validated in the
 * use case first and reinforced by the UNIQUE constraint in the database.
 *
 * <p>El mensaje NO incluye el correo: el alta es un endpoint publico, y
 * devolverlo convertia el 409 en un oraculo de enumeracion de cuentas (un POST
 * por candidato confirmaba la existencia y, segun el endpoint, hasta el rol).
 * El correo se queda en el contexto de la excepcion para el log, no en el
 * payload HTTP.
 */
public class CorreoDuplicadoException extends RuntimeException {

    private final String correo;

    public CorreoDuplicadoException(String correo) {
        super("Ya existe una cuenta con ese correo.");
        this.correo = correo;
    }

    /** Solo para diagnostico/log interno; nunca se serializa al cliente. */
    public String correo() {
        return correo;
    }
}
