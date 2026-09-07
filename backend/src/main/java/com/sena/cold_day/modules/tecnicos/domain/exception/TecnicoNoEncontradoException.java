package com.sena.cold_day.modules.tecnicos.domain.exception;

/**
 * Thrown when no active technician matches the requested id.
 */
public class TecnicoNoEncontradoException extends RuntimeException {

	public TecnicoNoEncontradoException(Long id) {
		super("Tecnico no encontrado: %d".formatted(id));
	}
}
