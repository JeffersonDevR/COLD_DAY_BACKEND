package com.sena.cold_day.core.modules.tecnicos.domain.valueobjects;

/**
 * Operational states of a technician (SRS RF-F1-05 / RF-F1-23).
 * {@code BLOQUEADO_POR_LIQUIDACION} inmoviliza al tecnico tras un cierre en
 * efectivo hasta que el administrador apruebe la consignacion (CU-13); queda
 * excluido del motor de geolocalizacion, que solo difunde DISPONIBLE.
 */
public enum EstadoOperativo {
	DISPONIBLE, OCUPADO, FUERA_DE_SERVICIO, BLOQUEADO_POR_LIQUIDACION
}
