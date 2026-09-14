package com.sena.cold_day.core.modules.administracion.domain.exception;

/** Conflicto de reglas del modulo administrativo. Mapeado a HTTP 409. */
public class AdministracionConflictoException extends RuntimeException {

    public AdministracionConflictoException(String mensaje) {
        super(mensaje);
    }
}
