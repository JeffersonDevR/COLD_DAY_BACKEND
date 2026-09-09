package com.sena.cold_day.core.shared.infrastructure.security;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Principal stored in SecurityContextHolder after validating the token.
 * Pure infrastructure — never crosses into the domain.
 */
public record AuthenticatedUser(UsuarioId usuarioId, Rol rol) {
}
