package com.sena.cold_day.core.modules.usuarios.domain.services;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Port to issue auth tokens. The domain does not know the signing algorithm,
 * ttl or claims — only that given a UsuarioId, a Rol and the usuario's
 * monotonic token version (design D11) it yields a Token.
 */
public interface TokenIssuer {

    Token emitir(UsuarioId usuarioId, Rol rol, int tokenVersion);
}
