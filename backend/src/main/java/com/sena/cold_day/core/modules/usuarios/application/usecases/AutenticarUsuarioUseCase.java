package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;

/** CU-02: login. Orchestrates credential verification + token issuing. */
@Service
public class AutenticarUsuarioUseCase {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoderPort passwordEncoder;
    private final TokenIssuer tokenIssuer;

    public AutenticarUsuarioUseCase(UsuarioRepository usuarioRepository, PasswordEncoderPort passwordEncoder,
            TokenIssuer tokenIssuer) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
    }

    public TokenResponse autenticar(String correo, String passwordPlano) {
        Usuario usuario = usuarioRepository.buscarPorCorreo(correo)
                .orElseThrow(CredencialesInvalidasException::new); // no reveal "correo no existe" vs "clave mala"

        usuario.verificarCredenciales(passwordPlano, passwordEncoder);

        var token = tokenIssuer.emitir(usuario.getUsuarioId(), usuario.getRol());
        return new TokenResponse(token.valor(), token.expiracion(), usuario.getRol().name());
    }
}
