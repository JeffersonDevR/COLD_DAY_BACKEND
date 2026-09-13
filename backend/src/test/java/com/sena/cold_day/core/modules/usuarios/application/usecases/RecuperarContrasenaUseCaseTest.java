package com.sena.cold_day.core.modules.usuarios.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@ExtendWith(MockitoExtension.class)
class RecuperarContrasenaUseCaseTest {

    @Mock UsuarioRepository usuarioRepository;
    @Mock TokenRecuperacionRepository tokenRepository;
    @Mock TokenGeneratorPort tokenGenerator;
    @Mock ApplicationEventPublisher events;
    @InjectMocks RecuperarContrasenaUseCase recuperar;

    private Usuario usuario(Long id, String correo, boolean activo) {
        return Usuario.reconstituir(id, "Ana", correo, "hash", null, null, Rol.CLIENTE,
                LocalDateTime.now(), true, activo, 0);
    }

    @Test
    void unknownEmailIsIndistinguishableAndPersistsNothing() {
        when(usuarioRepository.buscarPorCorreo("x@y.com")).thenReturn(Optional.empty());

        recuperar.solicitar("x@y.com");

        verify(tokenRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void inactiveAccountPersistsNothing() {
        when(usuarioRepository.buscarPorCorreo("ina@example.com")).thenReturn(Optional.of(usuario(11L, "ina@example.com", false)));

        recuperar.solicitar("ina@example.com");

        verify(tokenRepository, never()).save(any());
        verify(tokenRepository, never()).invalidarTodosDe(any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void activeAccountStoresHashWithThirtyMinuteTtlAndPublishesPlainToken() {
        when(usuarioRepository.buscarPorCorreo("ana@example.com")).thenReturn(Optional.of(usuario(10L, "ana@example.com", true)));
        when(tokenGenerator.generar()).thenReturn("plain-token");
        when(tokenGenerator.hash("plain-token")).thenReturn("hashed-token");

        Instant antes = Instant.now();
        recuperar.solicitar("ana@example.com");
        Instant despues = Instant.now();

        ArgumentCaptor<TokenRecuperacion> captor = ArgumentCaptor.forClass(TokenRecuperacion.class);
        verify(tokenRepository).save(captor.capture());
        TokenRecuperacion saved = captor.getValue();
        assertThat(saved.getUsuarioId()).isEqualTo(new UsuarioId(10L));
        assertThat(saved.getTokenHash()).isEqualTo("hashed-token").isNotEqualTo("plain-token");
        assertThat(saved.getCreadoEn()).isBetween(antes, despues);
        assertThat(saved.getExpiraEn())
                .isBetween(antes.plus(Duration.ofMinutes(29)), despues.plus(Duration.ofMinutes(31)));

        verify(tokenRepository).invalidarTodosDe(new UsuarioId(10L));
        verify(events).publishEvent(new RecuperacionSolicitada(10L, "ana@example.com", "plain-token"));
    }
}
