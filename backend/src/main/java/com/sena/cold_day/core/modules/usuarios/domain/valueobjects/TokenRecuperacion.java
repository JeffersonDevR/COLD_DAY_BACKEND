package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

import java.time.Instant;
import java.util.Objects;

/**
 * Single-use password reset token. Only the one-way hash is stored; validity is
 * determined by {@code expiraEn} and the {@code usado} flag.
 */
public class TokenRecuperacion {

    private Long id;
    private final UsuarioId usuarioId;
    private final String tokenHash;
    private final Instant expiraEn;
    private final Instant creadoEn;
    private boolean usado;

    private TokenRecuperacion(Long id, UsuarioId usuarioId, String tokenHash, Instant expiraEn,
            boolean usado, Instant creadoEn) {
        this.id = id;
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.expiraEn = expiraEn;
        this.usado = usado;
        this.creadoEn = creadoEn;
    }

    /** Issues a fresh, unused token that expires strictly after it is created. */
    public static TokenRecuperacion emitir(UsuarioId usuarioId, String tokenHash, Instant creadoEn,
            Instant expiraEn) {
        if (usuarioId == null) {
            throw new IllegalArgumentException("usuarioId requerido");
        }
        if (tokenHash == null || tokenHash.isBlank()) {
            throw new IllegalArgumentException("tokenHash requerido");
        }
        if (creadoEn == null || expiraEn == null) {
            throw new IllegalArgumentException("creadoEn y expiraEn requeridos");
        }
        if (!expiraEn.isAfter(creadoEn)) {
            throw new IllegalArgumentException("expiraEn debe ser posterior a creadoEn");
        }
        return new TokenRecuperacion(null, usuarioId, tokenHash, expiraEn, false, creadoEn);
    }

    /** Reconstitution from persistence. */
    public static TokenRecuperacion reconstituir(Long id, UsuarioId usuarioId, String tokenHash,
            Instant expiraEn, boolean usado, Instant creadoEn) {
        return new TokenRecuperacion(Objects.requireNonNull(id, "id requerido"), usuarioId, tokenHash,
                expiraEn, usado, creadoEn);
    }

    /** A token is usable only while unused and strictly before its expiry. */
    public boolean estaVigente(Instant ahora) {
        return !usado && expiraEn.isAfter(ahora);
    }

    public void marcarUsado() {
        this.usado = true;
    }

    public Long getId() { return id; }
    public UsuarioId getUsuarioId() { return usuarioId; }
    public String getTokenHash() { return tokenHash; }
    public Instant getExpiraEn() { return expiraEn; }
    public Instant getCreadoEn() { return creadoEn; }
    public boolean isUsado() { return usado; }
}
