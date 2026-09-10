package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Thrown when a tecnico tries to operate while its documentation is not
 * approved yet (CU-03). Mapped to 403 by TecnicoControllerAdvice.
 */
public class TecnicoNoValidadoException extends RuntimeException {

	public TecnicoNoValidadoException(TecnicoId id, EstadoValidacion estadoActual) {
		super("El técnico %d no puede operar: validación documental en estado %s".formatted(id, estadoActual));
	}
}
