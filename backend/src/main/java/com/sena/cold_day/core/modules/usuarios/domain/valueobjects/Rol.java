package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

/**
 * Classification role of the Usuario (CU-02 routes by rol). Not class
 * inheritance: role aggregates keep referencing UsuarioId independently.
 */
public enum Rol {
	CLIENTE, TECNICO, ADMINISTRADOR, CONTABLE
}
