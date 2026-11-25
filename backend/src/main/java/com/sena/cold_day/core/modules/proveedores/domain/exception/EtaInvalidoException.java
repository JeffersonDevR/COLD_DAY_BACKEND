package com.sena.cold_day.core.modules.proveedores.domain.exception;

/**
 * The ETA a supplier commits to on accept is outside {@code [1, maximo]} minutes.
 * Mapped to 400; nothing is read or written before it is raised.
 */
public class EtaInvalidoException extends IllegalArgumentException {

    public EtaInvalidoException(int maximoMinutos) {
        super("El ETA debe estar entre 1 y " + maximoMinutos + " minutos");
    }
}
