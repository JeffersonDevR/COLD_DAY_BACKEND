package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/** Read paths of the OT listings, enriched with cliente/técnico display names. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ListarOtUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final UsuarioId PRINCIPAL = new UsuarioId(7L);

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock UsuarioRepository usuarioRepository;

    private ListarOtUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ListarOtUseCase(otRepository, clienteRepository, tecnicoRepository, usuarioRepository);
    }

    @Test
    void listarTodasEnrichesEachOrderWithNames() {
        ClienteId clienteId = ClienteId.nueva();
        TecnicoId tecnicoId = TecnicoId.nueva();
        Ot ot = ot(clienteId, tecnicoId);
        when(otRepository.listarTodas()).thenReturn(List.of(ot));
        when(clienteRepository.buscarPorId(clienteId)).thenReturn(Optional.of(cliente(clienteId, 50L)));
        when(usuarioRepository.buscarPorId(new UsuarioId(50L))).thenReturn(Optional.of(usuario(50L, "Cliente Ana")));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .thenReturn(Optional.of(tecnico(tecnicoId, 7L)));
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(7L, "Tecnico Luis")));

        var resumen = useCase.listarTodas();

        assertThat(resumen).hasSize(1);
        assertThat(resumen.get(0).clienteNombre()).isEqualTo("Cliente Ana");
        assertThat(resumen.get(0).tecnicoNombre()).isEqualTo("Tecnico Luis");
    }

    @Test
    void listarTodasToleratesOrdersWithoutClienteOrTecnico() {
        Ot ot = ot(null, null);
        when(otRepository.listarTodas()).thenReturn(List.of(ot));

        var resumen = useCase.listarTodas();

        assertThat(resumen).hasSize(1);
        assertThat(resumen.get(0).clienteNombre()).isNull();
        assertThat(resumen.get(0).tecnicoNombre()).isNull();
    }

    @Test
    void listarPorClienteResolvesTheProfileFromThePrincipal() {
        ClienteId clienteId = ClienteId.nueva();
        Cliente cliente = cliente(clienteId, 50L);
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        when(otRepository.buscarPorCliente(clienteId)).thenReturn(List.of(ot(clienteId, null)));
        when(clienteRepository.buscarPorId(clienteId)).thenReturn(Optional.of(cliente));
        when(usuarioRepository.buscarPorId(new UsuarioId(50L))).thenReturn(Optional.of(usuario(50L, "Cliente Ana")));

        assertThat(useCase.listarPorCliente(PRINCIPAL)).hasSize(1);
    }

    @Test
    void listarPorClienteFailsWithoutAProfile() {
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.listarPorCliente(PRINCIPAL))
                .isInstanceOf(ClienteNoEncontradoException.class);
    }

    @Test
    void listarPorTecnicoResolvesTheProfileFromThePrincipal() {
        TecnicoId tecnicoId = TecnicoId.nueva();
        Tecnico tecnico = tecnico(tecnicoId, 7L);
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(7L)).thenReturn(Optional.of(tecnico));
        when(otRepository.buscarPorTecnico(tecnicoId)).thenReturn(List.of(ot(null, tecnicoId)));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.of(tecnico));
        when(usuarioRepository.buscarPorId(new UsuarioId(7L))).thenReturn(Optional.of(usuario(7L, "Tecnico Luis")));

        assertThat(useCase.listarPorTecnico(PRINCIPAL)).hasSize(1);
    }

    @Test
    void listarPorTecnicoFailsWithoutAProfile() {
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.listarPorTecnico(PRINCIPAL))
                .isInstanceOf(PerfilTecnicoNoEncontradoException.class);
    }

    private Ot ot(ClienteId clienteId, TecnicoId tecnicoId) {
        return Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8, -72.5), EstadoOt.EN_REPARACION, 10.0,
                null, AHORA, AHORA, null, null, null, null, null, null);
    }

    private Cliente cliente(ClienteId id, Long usuarioId) {
        return Cliente.reconstituir(id, new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.con("Calle 1", "Cúcuta", "Centro", null), true);
    }

    private Tecnico tecnico(TecnicoId id, Long usuarioId) {
        return Tecnico.reconstituir(id, usuarioId, "1098765001", java.util.Set.of(CategoriaServicio.REFRIGERACION),
                EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO, null, java.util.Set.of(), true,
                new Point(7.8, -72.5), false, null);
    }

    private Usuario usuario(Long id, String nombre) {
        return Usuario.reconstituir(id, nombre, "correo@example.com", "hash", "3001234567", null,
                Rol.TECNICO, java.time.LocalDateTime.now(), true, true, 0);
    }
}
