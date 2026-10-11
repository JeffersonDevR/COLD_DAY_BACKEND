package com.sena.cold_day.core.modules.usuarios.domain.services;

import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Port to issue auth tokens. The domain does not know the signing algorithm,
 * ttl or claims — only that given a UsuarioId, the derived role set (Option C),
 * the primary Rol and the usuario's monotonic token version (design D11) it
 * yields a Token.
 */
public interface TokenIssuer {

    Token emitir(UsuarioId usuarioId, Set<Rol> roles, Rol rolPrincipal, int tokenVersion);

    /**
     * Convenience for callers that only know a single role (tests, tooling): the
     * token then carries {@code {rol}} as the whole set. Production login always
     * goes through the 4-arg form with the set resolved by
     * {@link RolesDePerfilPort}.
     */
    default Token emitir(UsuarioId usuarioId, Rol rol, int tokenVersion) {
        return emitir(usuarioId, Set.of(rol), rol, tokenVersion);
    }
}
