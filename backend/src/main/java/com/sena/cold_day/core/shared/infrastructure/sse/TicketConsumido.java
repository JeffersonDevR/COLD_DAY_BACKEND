package com.sena.cold_day.core.shared.infrastructure.sse;

import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Identity a consumed SSE ticket was bound to. Carries the whole role set
 * (Option C): a single-role ticket would break the stream participant check for
 * a dual user whose CLIENTE/TECNICO capability is not the primary {@code rol}.
 */
public record TicketConsumido(UsuarioId usuarioId, Rol rol, Set<Rol> roles) {
}
