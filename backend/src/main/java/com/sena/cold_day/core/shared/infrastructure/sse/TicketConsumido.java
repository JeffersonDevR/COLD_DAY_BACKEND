package com.sena.cold_day.core.shared.infrastructure.sse;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Identity a consumed SSE ticket was bound to. */
public record TicketConsumido(UsuarioId usuarioId, Rol rol) {
}
