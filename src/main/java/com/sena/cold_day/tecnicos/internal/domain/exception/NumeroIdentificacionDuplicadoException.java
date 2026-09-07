package com.sena.cold_day.tecnicos.internal.domain.exception;

/**
 * Thrown when the numeroIdentificacion is already taken (unique constraint
 * violation, including rows retained by soft delete).
 */
public class NumeroIdentificacionDuplicadoException extends RuntimeException {

	public NumeroIdentificacionDuplicadoException(String numeroIdentificacion) {
		super("numeroIdentificacion duplicado: %s".formatted(numeroIdentificacion));
	}
}
