package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;

/**
 * CU-04: password reset request. Non-enumerating by design — unknown or
 * inactive accounts succeed silently without persisting a token, so callers
 * cannot distinguish them from active accounts.
 */
@Service
public class RecuperarContrasenaUseCase {

    private static final Duration VIGENCIA = Duration.ofMinutes(30);

    private final UsuarioRepository usuarioRepository;
    private final TokenRecuperacionRepository tokenRepository;
    private final TokenGeneratorPort tokenGenerator;
    private final ApplicationEventPublisher events;

    public RecuperarContrasenaUseCase(UsuarioRepository usuarioRepository,
            TokenRecuperacionRepository tokenRepository, TokenGeneratorPort tokenGenerator,
            ApplicationEventPublisher events) {
        this.usuarioRepository = usuarioRepository;
        this.tokenRepository = tokenRepository;
        this.tokenGenerator = tokenGenerator;
        this.events = events;
    }

    @Transactional
    public void solicitar(String correo) {
        // Always generate: the caller cannot distinguish account existence by the
        // work performed, and only an active account receives a persisted token.
        Instant ahora = Instant.now();
        String tokenPlano = tokenGenerator.generar();
        String hash = tokenGenerator.hash(tokenPlano);

        Optional<Usuario> encontrado = usuarioRepository.buscarPorCorreo(correo);
        if (encontrado.isEmpty() || !encontrado.get().isActivo()) {
            return;
        }
        Usuario usuario = encontrado.get();

        tokenRepository.invalidarTodosDe(usuario.getUsuarioId());
        tokenRepository.save(TokenRecuperacion.emitir(usuario.getUsuarioId(), hash, ahora, ahora.plus(VIGENCIA)));

        events.publishEvent(new RecuperacionSolicitada(usuario.getId(), usuario.getCorreo(), tokenPlano));
    }
}
