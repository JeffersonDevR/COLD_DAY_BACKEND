package com.sena.cold_day.core.modules.usuarios.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.TokenRecuperacionInvalidoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@ExtendWith(MockitoExtension.class)
class RestablecerContrasenaUseCaseTest {

    @Mock UsuarioRepository usuarioRepository;
    @Mock TokenRecuperacionRepository tokenRepository;
    @Mock TokenGeneratorPort tokenGenerator;
    @Mock PasswordEncoderPort passwordEncoder;
    @InjectMocks RestablecerContrasenaUseCase restablecer;

    private final UsuarioId usuarioId = new UsuarioId(10L);

    private TokenRecuperacion token(Instant expiraEn, boolean usado) {
        return TokenRecuperacion.reconstituir(1L, usuarioId, "hash-token", expiraEn, usado,
                Instant.now().minus(Duration.ofMinutes(30)));
    }

    private Usuario usuarioConHash(String hash) {
        return Usuario.reconstituir(10L, "Ana", "ana@example.com", hash, null, null, Rol.CLIENTE,
                LocalDateTime.now(), true, true, 0);
    }

    @Test
    void validTokenReplacesTheHashAndInvalidatesTheToken() {
        when(tokenGenerator.hash("token-plano")).thenReturn("hash-token");
        when(tokenRepository.buscarPorHash("hash-token"))
                .thenReturn(Optional.of(token(Instant.now().plus(Duration.ofMinutes(30)), false)));
        Usuario usuario = usuarioConHash("hash-vieja");
        when(usuarioRepository.buscarPorId(usuarioId)).thenReturn(Optional.of(usuario));
        when(passwordEncoder.encode("nueva-clave")).thenReturn("hash-nueva");

        restablecer.restablecer("token-plano", "nueva-clave");

        assertThat(usuario.getPasswordHash()).isEqualTo("hash-nueva");
        assertThat(usuario.getTokenVersion()).isEqualTo(1);
        verify(usuarioRepository).save(usuario);
        verify(tokenRepository).marcarUsado(eq(1L), any(Instant.class));
        verify(tokenRepository).invalidarTodosDe(usuarioId);
    }

    @Test
    void expiredTokenIsRejectedWithoutChangingThePassword() {
        when(tokenGenerator.hash("token-plano")).thenReturn("hash-token");
        Usuario usuario = usuarioConHash("hash-vieja");
        when(tokenRepository.buscarPorHash("hash-token"))
                .thenReturn(Optional.of(token(Instant.now().minusSeconds(1), false)));

        assertThatThrownBy(() -> restablecer.restablecer("token-plano", "nueva-clave"))
                .isInstanceOf(TokenRecuperacionInvalidoException.class);

        assertThat(usuario.getPasswordHash()).isEqualTo("hash-vieja");
        verify(usuarioRepository, never()).save(any());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void reusedTokenIsRejectedWithoutChangingThePassword() {
        when(tokenGenerator.hash("token-plano")).thenReturn("hash-token");
        Usuario usuario = usuarioConHash("hash-vieja");
        when(tokenRepository.buscarPorHash("hash-token"))
                .thenReturn(Optional.of(token(Instant.now().plus(Duration.ofMinutes(30)), true)));

        assertThatThrownBy(() -> restablecer.restablecer("token-plano", "nueva-clave"))
                .isInstanceOf(TokenRecuperacionInvalidoException.class);

        assertThat(usuario.getPasswordHash()).isEqualTo("hash-vieja");
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void unknownTokenIsRejected() {
        when(tokenGenerator.hash("token-plano")).thenReturn("hash-token");
        when(tokenRepository.buscarPorHash("hash-token")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> restablecer.restablecer("token-plano", "nueva-clave"))
                .isInstanceOf(TokenRecuperacionInvalidoException.class);

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void validTokenForUnknownUserIsRejected() {
        when(tokenGenerator.hash("token-plano")).thenReturn("hash-token");
        when(tokenRepository.buscarPorHash("hash-token"))
                .thenReturn(Optional.of(token(Instant.now().plus(Duration.ofMinutes(30)), false)));
        when(usuarioRepository.buscarPorId(usuarioId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> restablecer.restablecer("token-plano", "nueva-clave"))
                .isInstanceOf(TokenRecuperacionInvalidoException.class);

        verify(usuarioRepository, never()).save(any());
    }
}
