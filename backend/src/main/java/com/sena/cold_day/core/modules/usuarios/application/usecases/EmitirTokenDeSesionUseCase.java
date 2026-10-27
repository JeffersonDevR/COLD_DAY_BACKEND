package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.RolesDePerfilPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Re-emission of a session token for a usuario whose capabilities just changed.
 *
 * <p>Second-profile acquisition bumps {@code tokenVersion} to revoke the token
 * that was in flight (design D3), which would also kill the caller's own
 * session. This use case mints the replacement with exactly the inputs the login
 * path uses ({@link AutenticarUsuarioUseCase}): the capability set derived from
 * the persisted profile rows — never from the request — the primary role, the
 * display name and the post-bump version. Claims are built by the single
 * {@link TokenIssuer}, so the login and re-emission tokens cannot drift apart.
 *
 * <p>It reads the usuario instead of receiving it because the replacement is
 * requested after the profile transaction commits: the persisted row is the only
 * source of the new {@code tokenVersion} and of the new profile-derived role.
 */
@Service
public class EmitirTokenDeSesionUseCase {

    private final UsuarioRepository usuarioRepository;
    private final RolesDePerfilPort rolesDePerfil;
    private final TokenIssuer tokenIssuer;

    public EmitirTokenDeSesionUseCase(UsuarioRepository usuarioRepository, RolesDePerfilPort rolesDePerfil,
            TokenIssuer tokenIssuer) {
        this.usuarioRepository = usuarioRepository;
        this.rolesDePerfil = rolesDePerfil;
        this.tokenIssuer = tokenIssuer;
    }

    public TokenResponse emitirPara(UsuarioId usuarioId) {
        Usuario usuario = usuarioRepository.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

        Set<Rol> roles = rolesDePerfil.resolver(usuario.getUsuarioId(), usuario.getRol());
        var token = tokenIssuer.emitir(usuario.getUsuarioId(), usuario.getNombre(), roles, usuario.getRol(),
                usuario.getTokenVersion());
        return new TokenResponse(token.valor(), token.expiracion(), usuario.getRol().name(), List.copyOf(roles));
    }
}
