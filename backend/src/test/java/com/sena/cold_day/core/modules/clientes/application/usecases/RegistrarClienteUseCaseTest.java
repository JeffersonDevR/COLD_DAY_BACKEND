package com.sena.cold_day.core.modules.clientes.application.usecases;

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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteOnboardingRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.mappers.ClienteMapper;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteDuplicadoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Second-profile acquisition (spec capability {@code second-profile-acquisition}):
 * the client profile is created for the authenticated principal and the token
 * version is bumped so the token in flight is revoked; the controller returns
 * its replacement. The public onboarding path ({@code registrarNuevo}) must not
 * change.
 */
@ExtendWith(MockitoExtension.class)
class RegistrarClienteUseCaseTest {

    @Mock ClienteRepository clienteRepository;
    @Mock UsuarioRepository usuarioRepository;
    @Mock PasswordEncoderPort passwordEncoder;
    @Mock ApplicationEventPublisher events;
    @Spy ClienteMapper clienteMapper = new ClienteMapper();
    @InjectMocks RegistrarClienteUseCase useCase;

    private Usuario usuario(Long id, int tokenVersion) {
        return Usuario.reconstituir(id, "Ana", "ana@example.com", "hash", "3001234567", null,
                Rol.TECNICO, Instant.now(), false, true, tokenVersion);
    }

    private ClienteRequest request() {
        return new ClienteRequest(TipoCliente.B2C, "Calle 1", "Bogota", "Centro", null);
    }

    @Test
    void registrarBumpsTokenVersionSoTheNewCapabilityTakesEffectAtNextLogin() {
        Usuario principal = usuario(5L, 0);
        when(usuarioRepository.buscarPorId(new UsuarioId(5L))).thenReturn(Optional.of(principal));
        when(clienteRepository.findByUsuarioId(new UsuarioId(5L))).thenReturn(Optional.empty());
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = useCase.registrar(request(), new UsuarioId(5L));

        assertThat(response.usuarioId()).isEqualTo(new UsuarioId(5L));
        assertThat(response.tipoCliente()).isEqualTo(TipoCliente.B2C);
        assertThat(principal.getTokenVersion()).isEqualTo(1);
        verify(usuarioRepository).save(principal);
    }

    @Test
    void registrarRejectsDuplicateWhenThePrincipalAlreadyOwnsAClienteProfile() {
        when(usuarioRepository.buscarPorId(new UsuarioId(5L))).thenReturn(Optional.of(usuario(5L, 0)));
        when(clienteRepository.findByUsuarioId(new UsuarioId(5L)))
                .thenReturn(Optional.of(Cliente.registrar(new UsuarioId(5L), TipoCliente.B2C,
                        com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal
                                .sinUbicacion("Calle 1", "Bogota", "Centro"))));

        assertThatThrownBy(() -> useCase.registrar(request(), new UsuarioId(5L)))
                .isInstanceOf(ClienteDuplicadoException.class);
        verify(clienteRepository, never()).save(any(Cliente.class));
    }

    @Test
    void registrarNuevoLeavesTokenVersionUntouched() {
        when(usuarioRepository.existeCorreo("ana@example.com")).thenReturn(false);
        when(usuarioRepository.save(any(Usuario.class))).thenReturn(usuario(9L, 0));
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(invocation -> invocation.getArgument(0));

        useCase.registrarNuevo(new ClienteOnboardingRequest("Ana", "ana@example.com", "secreto", "3001234567",
                null, TipoCliente.B2C, "Calle 1", "Bogota", "Centro", null, true));

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(captor.capture());
        assertThat(captor.getValue().getTokenVersion()).isZero();
    }
}
