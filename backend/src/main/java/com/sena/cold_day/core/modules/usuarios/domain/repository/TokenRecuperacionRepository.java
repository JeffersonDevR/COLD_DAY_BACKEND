package com.sena.cold_day.core.modules.usuarios.domain.repository;

import java.time.Instant;
import java.util.Optional;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Port for persisting single-use password reset tokens. */
public interface TokenRecuperacionRepository {

    TokenRecuperacion save(TokenRecuperacion token);

    Optional<TokenRecuperacion> buscarPorHash(String tokenHash);

    /**
     * Marks one token as consumed. {@code ahora} is accepted for audit
     * consistency with the surrounding use case; the consumed state is boolean.
     */
    void marcarUsado(Long id, Instant ahora);

    /** Invalidates every still-pending token of one usuario (single-use guarantee). */
    void invalidarTodosDe(UsuarioId usuarioId);
}
