package com.sena.cold_day.core.modules.usuarios.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenIssuer;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Token;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@ExtendWith(MockitoExtension.class)
class AutenticarUsuarioUseCaseTest {

    @Mock UsuarioRepository usuarioRepository;
    @Mock PasswordEncoderPort passwordEncoder;
    @Mock TokenIssuer tokenIssuer;
    @InjectMocks AutenticarUsuarioUseCase autenticar;

    private Usuario usuario() {
        return Usuario.reconstituir(10L, "Ana", "ana@example.com", "hash", null, null, Rol.TECNICO,
                Instant.now().atOffset(java.time.ZoneOffset.UTC).toLocalDateTime(), false, true);
    }

    @Test
    void onlyValidCredentialsReachTheTokenIssuer() {
        when(usuarioRepository.buscarPorCorreo("ana@example.com")).thenReturn(java.util.Optional.of(usuario()));
        when(passwordEncoder.matches("secreto", "hash")).thenReturn(true);
        when(tokenIssuer.emitir(new UsuarioId(10L), Rol.TECNICO))
                .thenReturn(Token.de("jwt", Instant.now().plusSeconds(60)));

        TokenResponse response = autenticar.autenticar("ana@example.com", "secreto");

        assertThat(response.token()).isEqualTo("jwt");
        assertThat(response.rol()).isEqualTo("TECNICO");
        assertThat(response.expiracion()).isNotNull();
        verify(tokenIssuer).emitir(new UsuarioId(10L), Rol.TECNICO);
    }

    @Test
    void badPasswordNeverIssuesAToken() {
        when(usuarioRepository.buscarPorCorreo("ana@example.com")).thenReturn(Optional.of(usuario()));
        when(passwordEncoder.matches("mal", "hash")).thenReturn(false);

        assertThatThrownBy(() -> autenticar.autenticar("ana@example.com", "mal"))
                .isInstanceOf(CredencialesInvalidasException.class);
        verify(tokenIssuer, never()).emitir(any(), any());
    }

    @Test
    void unknownCorreoLooksLikeInvalidCredentialsNot404() {
        when(usuarioRepository.buscarPorCorreo("na@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticar.autenticar("na@example.com", "secreto"))
                .isInstanceOf(CredencialesInvalidasException.class);
        verify(tokenIssuer, never()).emitir(any(), any());
    }
}
