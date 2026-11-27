package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Permiso;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.PermisosPorRol;
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
 *
 * <p>{@code nombre} is the optional {@code nombre} JWT claim (preparacion-ionic
 * B3). Deterministic contract: the authentication filter normalizes an absent
 * or blank claim to the empty string WITHOUT touching the repository, so
 * legacy tokens issued before the claim existed keep authenticating — the
 * display name is simply empty until the usuario re-logs in. Authoritative
 * reads (e.g. {@code GET /api/usuarios/me}) always resolve the aggregate from
 * the repository; the claim is never re-persisted from the token.
 */
public record AuthenticatedUser(UsuarioId usuarioId, Rol rol, Set<Rol> roles, String nombre) {

    public AuthenticatedUser {
        if (roles == null || roles.isEmpty()) {
            roles = Set.of(rol);
        }
        nombre = nombre == null || nombre.isBlank() ? "" : nombre;
    }

    public boolean tieneRol(Rol candidato) {
        return roles.contains(candidato);
    }

    /** Los permisos salen de los roles en cada petición; no viajan en el token. */
    public boolean tienePermiso(Permiso permiso) {
        return roles.stream().anyMatch(r -> PermisosPorRol.de(r).contains(permiso));
    }

    public boolean tieneAlgunPermiso() {
        return roles.stream().anyMatch(r -> !PermisosPorRol.de(r).isEmpty());
    }

    /** {@code ROLE_x} por cada rol, más el nombre de cada permiso. */
    public Collection<GrantedAuthority> authorities() {
        List<GrantedAuthority> authorities = new ArrayList<>();
        roles.forEach(r -> authorities.add(new SimpleGrantedAuthority("ROLE_" + r.name())));
        roles.stream().flatMap(r -> PermisosPorRol.de(r).stream()).distinct()
                .forEach(p -> authorities.add(new SimpleGrantedAuthority(p.name())));
        return authorities;
    }

    /** Convenience for callers that only know the primary role. */
    public AuthenticatedUser(UsuarioId usuarioId, Rol rol) {
        this(usuarioId, rol, null, "");
    }

    /** Core form without the display name: it normalizes to the empty string. */
    public AuthenticatedUser(UsuarioId usuarioId, Rol rol, Set<Rol> roles) {
        this(usuarioId, rol, roles, "");
    }
}
