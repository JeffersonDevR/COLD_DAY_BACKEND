package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.TokenRecuperacionInvalidoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;

/**
 * CU-04: consumes a single-use reset token and replaces the usuario password.
 * Any invalid path (unknown, expired, reused token or missing usuario) raises
 * the same generic exception so the token cannot be probed.
 */
@Service
public class RestablecerContrasenaUseCase {

    private final UsuarioRepository usuarioRepository;
    private final TokenRecuperacionRepository tokenRepository;
    private final TokenGeneratorPort tokenGenerator;
    private final PasswordEncoderPort passwordEncoder;

    public RestablecerContrasenaUseCase(UsuarioRepository usuarioRepository,
            TokenRecuperacionRepository tokenRepository, TokenGeneratorPort tokenGenerator,
            PasswordEncoderPort passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.tokenRepository = tokenRepository;
        this.tokenGenerator = tokenGenerator;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void restablecer(String tokenPlano, String nuevaPassword) {
        String hash = tokenGenerator.hash(tokenPlano);
        TokenRecuperacion token = tokenRepository.buscarPorHash(hash)
                .orElseThrow(TokenRecuperacionInvalidoException::new);

        Instant ahora = Instant.now();
        if (!token.estaVigente(ahora)) {
            throw new TokenRecuperacionInvalidoException();
        }

        Usuario usuario = usuarioRepository.buscarPorId(token.getUsuarioId())
                .orElseThrow(TokenRecuperacionInvalidoException::new);

        usuario.cambiarPassword(nuevaPassword, passwordEncoder);
        // Revoke every token issued before the reset (design D11).
        usuario.incrementarTokenVersion();
        usuarioRepository.save(usuario);
        tokenRepository.marcarUsado(token.getId(), ahora);
        tokenRepository.invalidarTodosDe(usuario.getUsuarioId());
    }
}
