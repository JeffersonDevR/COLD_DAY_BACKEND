package com.sena.cold_day.tecnicos.internal.domain;

/**
 * Base operational states of a technician (SRS RF-F1-05).
 * BLOQUEADO_POR_LIQUIDACION is deferred to the liquidacion module.
 */
public enum EstadoOperativo {
	DISPONIBLE, OCUPADO, FUERA_DE_SERVICIO
}
