package com.sena.cold_day.core.shared.infrastructure.security;

import java.io.IOException;
import java.util.List;

import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * SOLO DESARROLLO LOCAL: "apaga" la autenticacion ejecutando como un usuario
 * existente toda peticion que no traiga un JWT valido.
 * <p>
 * Los controladores dependen de saber quien llama y con que rol
 * ({@code @AuthenticationPrincipal}, {@code @PreAuthorize}), asi que en lugar de
 * un {@code permitAll} (que dejaria el principal nulo) se autentica como:
 * <ul>
 * <li>el usuario del header {@code X-Dev-Usuario: <correo>}, si viene; o</li>
 * <li>el usuario por defecto {@code app.security.dev-bypass.correo} (admin sembrado).</li>
 * </ul>
 * Si el correo no existe (p. ej. el seed esta apagado) la peticion queda anonima.
 * Un JWT valido en {@code Authorization} tiene prioridad y este filtro no interviene.
 * <p>
 * Solo se crea con {@code app.security.dev-bypass.enabled=true} (activo en
 * {@code application-dev.properties}). Si el perfil {@code prod} esta activo, el
 * arranque falla: este bypass jamas debe existir en produccion.
 */
@Component
@ConditionalOnProperty(name = "app.security.dev-bypass.enabled", havingValue = "true")
public class DevAuthBypassFilter extends OncePerRequestFilter {

    static final String HEADER_USUARIO = "X-Dev-Usuario";

    private static final Logger log = LoggerFactory.getLogger(DevAuthBypassFilter.class);

    private final UsuarioRepository usuarioRepository;
    private final String correoPorDefecto;

    public DevAuthBypassFilter(UsuarioRepository usuarioRepository, Environment environment,
            @Value("${app.security.dev-bypass.correo:admin@coldday.com.co}") String correoPorDefecto) {
        if (environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException(
                    "app.security.dev-bypass.enabled=true no esta permitido con el perfil prod: "
                            + "desactiva la autenticacion solo en desarrollo local.");
        }
        this.usuarioRepository = usuarioRepository;
        this.correoPorDefecto = correoPorDefecto;
        log.warn("AUTENTICACION DESACTIVADA (dev-bypass): las peticiones sin JWT se ejecutan como '{}' "
                + "o como el usuario del header {}. Solo para desarrollo local.", correoPorDefecto, HEADER_USUARIO);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String correo = request.getHeader(HEADER_USUARIO);
            if (correo == null || correo.isBlank()) {
                correo = correoPorDefecto;
            }
            usuarioRepository.buscarPorCorreo(correo.trim()).ifPresentOrElse(
                    this::autenticarComo,
                    () -> log.warn("dev-bypass: no existe el usuario '{}'; la peticion queda anonima "
                            + "(¿seed apagado?)", request.getHeader(HEADER_USUARIO) != null
                                    ? request.getHeader(HEADER_USUARIO) : correoPorDefecto));
        }
        chain.doFilter(request, response);
    }

    private void autenticarComo(Usuario usuario) {
        var principal = new AuthenticatedUser(new UsuarioId(usuario.getId()), usuario.getRol());
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRol().name()));
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }
}
