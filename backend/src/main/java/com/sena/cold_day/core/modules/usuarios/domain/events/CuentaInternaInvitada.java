package com.sena.cold_day.core.modules.usuarios.domain.events;

/**
 * Se creó una cuenta del panel y hay que invitar a su dueño. El token en claro
 * viaja aquí para que el notificador lo entregue; solo se guarda su hash.
 */
public record CuentaInternaInvitada(Long usuarioId, String correo, String token) {
}
