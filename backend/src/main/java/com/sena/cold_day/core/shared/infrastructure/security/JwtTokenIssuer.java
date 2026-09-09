package com.sena.cold_day.core.shared.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtTokenIssuer implements TokenIssuer {

    private final SecretKey key;
    private final long expiracionMs;

    public JwtTokenIssuer(JwtProperties props) {
        this.key = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
        this.expiracionMs = props.expiracionMs();
    }

    @Override
    public Token emitir(UsuarioId usuarioId, Rol rol) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plusMillis(expiracionMs);
        String jwt = Jwts.builder()
                .subject(usuarioId.valor().toString())
                .claim("rol", rol.name())
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(expira))
                .signWith(key)
                .compact();
        return Token.de(jwt, expira);
    }
}
