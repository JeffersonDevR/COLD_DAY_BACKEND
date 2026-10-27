package com.sena.cold_day.core.modules.usuarios.domain.services;

import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Port to issue auth tokens. The domain does not know the signing algorithm,
 * ttl or claims — only that given a UsuarioId, the usuario's display name, the
 * derived role set (Option C), the primary Rol and the usuario's monotonic
 * token version (design D11) it yields a Token.
 */
public interface TokenIssuer {

    /**
     * @param nombre the usuario's display name, carried as the optional
     *        {@code nombre} claim. A {@code null} or blank value (convenience
     *        callers, tooling) omits the claim entirely, so legacy consumers
     *        never see a sentinel value.
     */
    Token emitir(UsuarioId usuarioId, String nombre, Set<Rol> roles, Rol rolPrincipal, int tokenVersion);

    /**
     * Legacy form without the display name: the token then carries no
     * {@code nombre} claim at all. Kept as a default so existing tests and
     * tooling keep working; production login always goes through the 5-arg
     * form with the set resolved by {@link RolesDePerfilPort}.
     */
    default Token emitir(UsuarioId usuarioId, Set<Rol> roles, Rol rolPrincipal, int tokenVersion) {
        return emitir(usuarioId, null, roles, rolPrincipal, tokenVersion);
    }

    /**
     * Convenience for callers that only know a single role (tests, tooling): the
     * token then carries {@code {rol}} as the whole set. Production login always
     * goes through the 5-arg form with the set resolved by
     * {@link RolesDePerfilPort}.
     */
    default Token emitir(UsuarioId usuarioId, Rol rol, int tokenVersion) {
        return emitir(usuarioId, Set.of(rol), rol, tokenVersion);
    }
}
