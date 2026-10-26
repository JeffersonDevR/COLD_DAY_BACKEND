package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.RolesDePerfilPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** CU-02: login. Orchestrates credential verification + token issuing. */
@Service
public class AutenticarUsuarioUseCase {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoderPort passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final RolesDePerfilPort rolesDePerfil;

    public AutenticarUsuarioUseCase(UsuarioRepository usuarioRepository, PasswordEncoderPort passwordEncoder,
            TokenIssuer tokenIssuer, RolesDePerfilPort rolesDePerfil) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
        this.rolesDePerfil = rolesDePerfil;
    }

    public TokenResponse autenticar(String correo, String passwordPlano) {
        Usuario usuario = usuarioRepository.buscarPorCorreo(correo)
                .orElseThrow(CredencialesInvalidasException::new); // no reveal "correo no existe" vs "clave mala"

        usuario.verificarCredenciales(passwordPlano, passwordEncoder);

        // Option C: capabilities are derived server-side from persisted profile
        // rows; nothing from the request body can widen them (M3/M5).
        Set<Rol> roles = rolesDePerfil.resolver(usuario.getUsuarioId(), usuario.getRol());
        var token = tokenIssuer.emitir(usuario.getUsuarioId(), usuario.getNombre(), roles,
                usuario.getRol(), usuario.getTokenVersion());
        return new TokenResponse(token.valor(), token.expiracion(), usuario.getRol().name(), List.copyOf(roles));
    }
}
