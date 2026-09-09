package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

public class TecnicoAsignadoException extends RuntimeException {

    public TecnicoAsignadoException(String numeroDeIdentificacion) {

        super("El tecnico: %s se encuentra actualmente asignado a una orden de trabajo".formatted(numeroDeIdentificacion));
    }
}
