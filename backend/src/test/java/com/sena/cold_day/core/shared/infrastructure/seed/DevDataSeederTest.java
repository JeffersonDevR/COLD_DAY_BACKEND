package com.sena.cold_day.core.shared.infrastructure.seed;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/** Idempotent and self-healing demo seed (DevDataSeeder). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DevDataSeederTest {

    @Mock UsuarioRepository usuarioRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock ProveedorRepository proveedorRepository;
    @Mock Proveedor proveedor;
    @Mock PasswordEncoderPort encoder;

    private DevDataSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new DevDataSeeder(
                usuarioRepository, tecnicoRepository, clienteRepository, proveedorRepository, encoder, "demo1234");
        when(encoder.encode(anyString())).thenReturn("hash");
    }

    @Test
    void runSeedsFiveClientesFiveTecnicosAndTheAdminRoles() {
        AtomicLong ids = new AtomicLong(1);
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocation -> {
            Usuario usuario = invocation.getArgument(0);
            return Usuario.reconstituir(ids.getAndIncrement(), usuario.getNombre(), usuario.getCorreo(),
                    usuario.getPasswordHash(), usuario.getTelefono(), usuario.getFotoUrl(), usuario.getRol(),
                    usuario.getFechaRegistro(), usuario.isHabeasDataAceptado(), usuario.isActivo(), 0);
        });
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tecnicoRepository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(proveedorRepository.save(any(Proveedor.class))).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run(null);

        verify(usuarioRepository, times(13)).save(any(Usuario.class));
        verify(clienteRepository, times(5)).save(any(Cliente.class));
        verify(tecnicoRepository, times(5)).save(any(Tecnico.class));
        verify(proveedorRepository).save(any(Proveedor.class));
    }

    @Test
    void runIsIdempotentWhenUsuariosAndProfilesAlreadyExist() {
        when(usuarioRepository.buscarPorCorreo(anyString()))
                .thenAnswer(invocation -> Optional.of(usuario(99L, invocation.getArgument(0))));
        when(clienteRepository.findByUsuarioId(any(UsuarioId.class))).thenReturn(Optional.of(cliente()));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(anyLong())).thenReturn(Optional.of(tecnico()));
        when(proveedorRepository.findByUsuarioId(anyLong())).thenReturn(Optional.of(proveedor));

        seeder.run(null);

        verify(usuarioRepository, never()).save(any(Usuario.class));
        verify(clienteRepository, never()).save(any(Cliente.class));
        verify(tecnicoRepository, never()).save(any(Tecnico.class));
    }

    private Usuario usuario(Long id, String correo) {
        return Usuario.reconstituir(id, "Ana", correo, "hash", "3001234567", null, Rol.CLIENTE,
                java.time.LocalDateTime.now(), true, true, 0);
    }

    private Cliente cliente() {
        return Cliente.reconstituir(com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId.nueva(),
                new UsuarioId(99L), com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente.B2C,
                com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal
                        .con("Calle 1", "Cúcuta", "Centro", null),
                true);
    }

    private Tecnico tecnico() {
        return Tecnico.reconstituir(TecnicoId.nueva(), 99L, "1098765001",
                Set.of(CategoriaServicio.REFRIGERACION), EstadoOperativo.DISPONIBLE, EstadoValidacion.APROBADO,
                null, Set.of(), true, new Point(7.8, -72.5), false, null);
    }
}
