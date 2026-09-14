package com.sena.cold_day.core.shared.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

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
    public Token emitir(UsuarioId usuarioId, Rol rol, int tokenVersion) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plusMillis(expiracionMs);
        // JWT NumericDate (RFC 7519) en segundos: 100% java.time, sin
        // java.util.Date (java:S2143). JJWT serializa los Date como segundos de
        // todos modos, asi que el formato en el token es identico; solo se
        // pierde precision sub-segundo en un TTL de 1 hora. Verificado con
        // SeguridadIT (login, expiracion y revocacion).
        String jwt = Jwts.builder()
                .subject(usuarioId.valor().toString())
                .claim("rol", rol.name())
                .claim("ver", tokenVersion)
                .claim("iat", ahora.getEpochSecond())
                .claim("exp", expira.getEpochSecond())
                .signWith(key)
                .compact();
        return Token.de(jwt, expira);
    }
}
