package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Design D11: issued JWTs must carry the monotonic token version as the
 * {@code ver} claim so the authentication filter can revoke stale tokens.
 */
class JwtTokenIssuerTest {

    private static final String SECRET = "cold-day-test-secret-key-32-bytes-long!!";

    private Claims parse(String jwt) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt).getPayload();
    }

    @Test
    void embedsSubjectRoleAndTokenVersion() {
        JwtTokenIssuer issuer = new JwtTokenIssuer(new JwtProperties(SECRET, 3_600_000));

        Token token = issuer.emitir(new UsuarioId(42L), Rol.TECNICO, 7);

        Claims claims = parse(token.valor());
        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("rol", String.class)).isEqualTo("TECNICO");
        assertThat(claims.get("ver", Integer.class)).isEqualTo(7);
    }

    @Test
    void tokenVersionTravelsIndependentlyOfRole() {
        JwtTokenIssuer issuer = new JwtTokenIssuer(new JwtProperties(SECRET, 1_000));

        Token token = issuer.emitir(new UsuarioId(1L), Rol.ADMINISTRADOR, 0);

        assertThat(parse(token.valor()).get("ver", Integer.class)).isZero();
    }
}
