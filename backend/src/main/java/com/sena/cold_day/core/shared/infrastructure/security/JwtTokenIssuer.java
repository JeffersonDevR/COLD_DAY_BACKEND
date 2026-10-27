package com.sena.cold_day.core.shared.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Set;

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
    public Token emitir(UsuarioId usuarioId, String nombre, Set<Rol> roles, Rol rolPrincipal, int tokenVersion) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plusMillis(expiracionMs);
        // JWT NumericDate (RFC 7519) en segundos: 100% java.time, sin
        // java.util.Date (java:S2143). JJWT serializa los Date como segundos de
        // todos modos, asi que el formato en el token es identico; solo se
        // pierde precision sub-segundo en un TTL de 1 hora. Verificado con
        // SeguridadIT (login, expiracion y revocacion).
        //
        // Option C: "roles" lleva el conjunto derivado (autoridades); "rol" se
        // mantiene como rol primario para display/back-compat y para que los
        // tokens antiguos (sin "roles") sigan autenticando via el fallback del
        // filtro.
        var constructor = Jwts.builder()
                .subject(usuarioId.valor().toString())
                .claim("rol", rolPrincipal.name())
                .claim("roles", roles.stream().map(Enum::name).toList())
                .claim("ver", tokenVersion);
        // "nombre" es opcional: un valor vacio/nulo (formularios de
        // conveniencia, tooling) simplemente omite el claim, sin centinela.
        if (nombre != null && !nombre.isBlank()) {
            constructor = constructor.claim("nombre", nombre);
        }
        String jwt = constructor
                .claim("iat", ahora.getEpochSecond())
                .claim("exp", expira.getEpochSecond())
                .signWith(key)
                .compact();
        return Token.de(jwt, expira);
    }
}
