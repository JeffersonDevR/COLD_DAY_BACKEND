package com.sena.cold_day.core.modules.usuarios.domain.events;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** Published when a new Usuario is registered. */
public record UsuarioRegistrado(Long usuarioId, Rol rol) {
}
