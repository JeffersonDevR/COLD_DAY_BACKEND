package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoPerfilRequest;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoDuplicadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.TecnicoPerfilApiRequest;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import tools.jackson.databind.ObjectMapper;

/**
 * Second-profile acquisition (spec capability {@code second-profile-acquisition}):
 * the technician profile is created for the authenticated principal, the role
 * comes only from the endpoint, and the token version is bumped so the token in
 * flight is revoked; the controller returns its replacement.
 */
@ExtendWith(MockitoExtension.class)
class RegistrarPerfilTecnicoUseCaseTest {

    @Mock TecnicoRepository tecnicoRepository;
    @Mock UsuarioRepository usuarioRepository;
    @Spy TecnicoMapper mapper = new TecnicoMapper();
    @InjectMocks RegistrarPerfilTecnicoUseCase useCase;

    private Usuario usuario(Long id) {
        return Usuario.reconstituir(id, "Ana", "ana@example.com", "hash", "3001234567", null,
                Rol.CLIENTE, Instant.now(), false, true, 0);
    }

    private TecnicoPerfilRequest request(String numeroIdentificacion) {
        return new TecnicoPerfilRequest(numeroIdentificacion, Set.of(CategoriaServicio.REFRIGERACION), Set.of());
    }

    @Test
    void createsTecnicoProfileForThePrincipalAndBumpsTokenVersion() {
        Usuario principal = usuario(7L);
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(principal));
        when(tecnicoRepository.findByUsuarioId(7L)).thenReturn(Optional.empty());
        when(tecnicoRepository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = useCase.registrar(new UsuarioId(7L), request("123"));

        assertThat(response.usuarioId()).isEqualTo(7L);
        assertThat(response.numeroIdentificacion()).isEqualTo("123");
        assertThat(response.estadoValidacion()).isEqualTo(EstadoValidacion.PENDIENTE);
        assertThat(response.categoriasServicio()).containsExactly(CategoriaServicio.REFRIGERACION);
        // The in-flight token is revoked; the controller returns the replacement.
        assertThat(principal.getTokenVersion()).isEqualTo(1);
        verify(usuarioRepository).save(principal);
    }

    @Test
    void rejectsDuplicateWhenThePrincipalAlreadyOwnsATecnicoProfile() {
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(7L)));
        when(tecnicoRepository.findByUsuarioId(7L)).thenReturn(Optional.of(Tecnico.crear(7L, "123",
                Set.of(CategoriaServicio.REFRIGERACION), Set.of())));

        assertThatThrownBy(() -> useCase.registrar(new UsuarioId(7L), request("456")))
                .isInstanceOf(TecnicoDuplicadoException.class);
        verify(tecnicoRepository, never()).save(any(Tecnico.class));
    }

    @Test
    void rejectsWhenThePrincipalDoesNotResolveToAPersistedUsuario() {
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.registrar(new UsuarioId(7L), request("123")))
                .isInstanceOf(UsuarioNoEncontradoException.class);
        verify(tecnicoRepository, never()).save(any(Tecnico.class));
    }

    /**
     * M5: the request body may carry a {@code rol}, but the request DTO has no
     * role component, so Jackson drops it and the profile is always the
     * technician one, bound to the principal — never a body-supplied role.
     */
    @Test
    void ignoresAnyRoleInTheBodyAndCreatesATecnicoProfileForThePrincipal() throws Exception {
        TecnicoPerfilApiRequest api = new ObjectMapper().readValue(
                "{\"numeroIdentificacion\":\"123\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                        + "\"rol\":\"ADMINISTRADOR\"}",
                TecnicoPerfilApiRequest.class);

        Usuario principal = usuario(7L);
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(principal));
        when(tecnicoRepository.findByUsuarioId(7L)).thenReturn(Optional.empty());
        when(tecnicoRepository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = useCase.registrar(new UsuarioId(7L),
                new TecnicoPerfilRequest(api.numeroIdentificacion(), api.categoriasServicio(), api.certificaciones()));

        // Identity comes from the principal, not the body; the profile is TECNICO by construction.
        assertThat(response.usuarioId()).isEqualTo(7L);
        assertThat(response.estadoValidacion()).isEqualTo(EstadoValidacion.PENDIENTE);
        assertThat(response.categoriasServicio()).containsExactly(CategoriaServicio.REFRIGERACION);
    }
}
