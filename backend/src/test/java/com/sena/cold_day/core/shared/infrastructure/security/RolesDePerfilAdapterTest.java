package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * M3 (least privilege): the derived capability set is
 * {@code {rolPrimario}} UNION {CLIENTE if clientes row} UNION {TECNICO if active
 * tecnico row} UNION {PROVEEDOR if proveedor row}. It must NEVER derive
 * ADMINISTRADOR or CONTABLE from a profile row — those come solely from
 * {@code usuario.rol}.
 */
@ExtendWith(MockitoExtension.class)
class RolesDePerfilAdapterTest {

    private static final UsuarioId USUARIO = new UsuarioId(10L);

    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ProveedorRepository proveedorRepository;
    @InjectMocks RolesDePerfilAdapter adapter;

    @Test
    void dualUserUnionsPrimaryClienteAndTecnico() {
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.of(mock(Cliente.class)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(10L)).thenReturn(Optional.of(mock(Tecnico.class)));

        Set<Rol> roles = adapter.resolver(USUARIO, Rol.CLIENTE);

        assertThat(roles).containsExactlyInAnyOrder(Rol.CLIENTE, Rol.TECNICO);
    }

    @Test
    void neverDerivesAdministradorOrContableFromProfileRows() {
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.of(mock(Cliente.class)));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(10L)).thenReturn(Optional.of(mock(Tecnico.class)));
        when(proveedorRepository.findByUsuarioId(10L)).thenReturn(Optional.of(mock(Proveedor.class)));

        Set<Rol> roles = adapter.resolver(USUARIO, Rol.CLIENTE);

        assertThat(roles).doesNotContain(Rol.ADMINISTRADOR, Rol.CONTABLE);
        assertThat(roles).containsExactlyInAnyOrder(Rol.CLIENTE, Rol.TECNICO, Rol.PROVEEDOR);
    }

    @Test
    void userWithoutProfileRowsKeepsOnlyThePrimaryRole() {
        Set<Rol> roles = adapter.resolver(USUARIO, Rol.CLIENTE);

        assertThat(roles).containsExactly(Rol.CLIENTE);
    }

    @Test
    void administradorPrimaryRoleIsPreservedAndNeverAmplifiedByProfiles() {
        Set<Rol> roles = adapter.resolver(USUARIO, Rol.ADMINISTRADOR);

        assertThat(roles).containsExactly(Rol.ADMINISTRADOR);
    }

    @Test
    void proveedorRowAddsTheProveedorCapabilityToThePrimaryRole() {
        when(proveedorRepository.findByUsuarioId(10L)).thenReturn(Optional.of(mock(Proveedor.class)));

        Set<Rol> roles = adapter.resolver(USUARIO, Rol.CLIENTE);

        assertThat(roles).containsExactlyInAnyOrder(Rol.CLIENTE, Rol.PROVEEDOR);
    }
}
