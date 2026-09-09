package com.sena.cold_day.core.modules.tecnicos.domain.valueobjects;

/**
 * Documentary validation gate (CU-03), orthogonal to EstadoOperativo (CU-07):
 * the tecnico cannot reach operative states while not APROBADO.
 */
public enum EstadoValidacion {
	PENDIENTE, APROBADO, RECHAZADO
}
