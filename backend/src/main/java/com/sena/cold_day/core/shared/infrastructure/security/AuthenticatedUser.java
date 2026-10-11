package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Principal stored in SecurityContextHolder after validating the token.
 * Pure infrastructure — never crosses into the domain.
 *
 * <p>Option C: {@code rol} is the primary/registration role (display and
 * back-compat); {@code roles} is the expanded capability set carried by the
 * token. {@link #tieneRol(Rol)} is the single membership query authorization
 * uses, so an admin check reflects exactly the granted set.
 */
public record AuthenticatedUser(UsuarioId usuarioId, Rol rol, Set<Rol> roles) {

    public AuthenticatedUser {
        if (roles == null || roles.isEmpty()) {
            roles = Set.of(rol);
        }
    }

    /** Convenience for callers that only know the primary role. */
    public AuthenticatedUser(UsuarioId usuarioId, Rol rol) {
        this(usuarioId, rol, Set.of(rol));
    }

    public boolean tieneRol(Rol candidato) {
        return roles.contains(candidato);
    }
}
