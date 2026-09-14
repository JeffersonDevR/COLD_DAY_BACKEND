package com.sena.cold_day.core.shared.infrastructure.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import javax.crypto.SecretKey;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final SecretKey key;
    private final UsuarioRepository usuarioRepository;

    public JwtAuthenticationFilter(JwtProperties props, UsuarioRepository usuarioRepository) {
        this.key = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String jwt = header.substring(7);
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                        .parseSignedClaims(jwt).getPayload();

                UsuarioId usuarioId = new UsuarioId(Long.parseLong(claims.getSubject()));
                Rol rol = Rol.valueOf(claims.get("rol", String.class));

                if (!versionVigente(usuarioId, claims.get("ver"))) {
                    // Stale ver → revoked by a password reset (design D11).
                    SecurityContextHolder.clearContext();
                } else {
                    AuthenticatedUser principal = new AuthenticatedUser(usuarioId, rol);
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + rol.name()));
                    var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException | IllegalArgumentException _) {
                // Invalid/expired token → remains anonymous; the authorization filter decides
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }

    /**
     * The token's {@code ver} claim must match the persisted usuario's monotonic
     * token version. Decision D7: when the subject does not resolve to a
     * persisted usuario the check is skipped and prior behaviour is preserved.
     */
    private boolean versionVigente(UsuarioId usuarioId, Object verClaim) {
        return usuarioRepository.buscarPorId(usuarioId)
                .map(usuario -> usuario.getTokenVersion() == asInt(verClaim))
                .orElse(true);
    }

    private int asInt(Object raw) {
        return raw instanceof Number numero ? numero.intValue() : 0;
    }
}
