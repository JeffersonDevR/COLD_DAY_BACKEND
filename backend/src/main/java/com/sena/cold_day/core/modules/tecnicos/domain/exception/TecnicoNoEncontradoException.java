package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Thrown when no active technician matches the requested id.
 */
public class TecnicoNoEncontradoException extends RuntimeException {

	public TecnicoNoEncontradoException(TecnicoId id) {
		super("Tecnico no encontrado: %d".formatted(id));
	}
}
