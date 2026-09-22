package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "token_recuperacion", indexes = {
        @Index(name = "idx_token_recuperacion_usuario_id", columnList = "usuario_id")
})
@Getter
@Setter
@NoArgsConstructor
public class TokenRecuperacionJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    @Column(nullable = false)
    private boolean usado;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    public static TokenRecuperacionJpaEntity fromDomain(TokenRecuperacion token) {
        TokenRecuperacionJpaEntity target = new TokenRecuperacionJpaEntity();
        target.id = token.getId();
        target.usuarioId = token.getUsuarioId().valor();
        target.tokenHash = token.getTokenHash();
        target.expiraEn = token.getExpiraEn();
        target.usado = token.isUsado();
        target.creadoEn = token.getCreadoEn();
        return target;
    }

    public TokenRecuperacion toDomain() {
        return TokenRecuperacion.reconstituir(id, new UsuarioId(usuarioId), tokenHash, expiraEn, usado, creadoEn);
    }
}
