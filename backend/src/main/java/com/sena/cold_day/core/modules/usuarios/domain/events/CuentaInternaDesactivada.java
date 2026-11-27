package com.sena.cold_day.core.modules.usuarios.domain.events;

/** Se desactivó una cuenta del panel: lo que tuviera abierto debe dejar de servir. */
public record CuentaInternaDesactivada(Long usuarioId) {
}
