package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Participation rule for an OT's read paths (dual-role bug D1).
 *
 * <p>Ownership is decided by the resource rows, not by the other capabilities the
 * caller holds: a user who owns the OT's client profile reads it even when they
 * are also a technician (or supplier). The technician branch keeps its original
 * meaning — only the assigned technician — so a technician who is neither the
 * owner nor the assignee is still denied, and an administrator keeps full access.
 */
@ExtendWith(MockitoExtension.class)
class AutorizacionPropietarioTest {

    private static final UsuarioId USUARIO = new UsuarioId(10L);
    private static final ClienteId CLIENTE_DUENO = ClienteId.nueva();

    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ProveedorRepository proveedorRepository;
    @InjectMocks AutorizacionPropietario autorizacion;

    /** D1 core case: the dual-role user is the client owner of the order they requested. */
    @Test
    void dualRoleClientOwnerReadsTheirOwnOrder() {
        Cliente dueno = cliente(CLIENTE_DUENO);
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.of(dueno));

        assertThat(autorizacion.esParticipanteOAdmin(
                principal(Set.of(Rol.CLIENTE, Rol.TECNICO), Rol.TECNICO), ot(null)))
                .as("the technician capability must never subtract the owner's access")
                .isTrue();
    }

    /** The legitimate denial: a technician that neither owns nor is assigned the order. */
    @Test
    void technicianWhoIsNotTheOwnerIsDenied() {
        Tecnico otro = tecnico(TecnicoId.nueva());
        TecnicoId asignadoAOtro = TecnicoId.nueva();
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.empty());
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO.valor())).thenReturn(Optional.of(otro));

        assertThat(autorizacion.esParticipanteOAdmin(principal(Set.of(Rol.TECNICO), Rol.TECNICO), ot(asignadoAOtro)))
                .isFalse();
    }

    @Test
    void clientOwnerReadsTheirOrder() {
        Cliente dueno = cliente(CLIENTE_DUENO);
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.of(dueno));

        assertThat(autorizacion.esParticipanteOAdmin(principal(Set.of(Rol.CLIENTE), Rol.CLIENTE),
                ot(null))).isTrue();
    }

    @Test
    void administratorReadsAnyOrder() {
        assertThat(autorizacion.esParticipanteOAdmin(principal(Set.of(Rol.ADMINISTRADOR), Rol.ADMINISTRADOR),
                ot(null))).isTrue();
        verifyNoInteractions(clienteRepository, tecnicoRepository, proveedorRepository);
    }

    /** Unchanged rule: the assigned technician keeps access even without a client profile. */
    @Test
    void assignedTechnicianKeepsAccess() {
        TecnicoId asignado = TecnicoId.nueva();
        Tecnico perfil = tecnico(asignado);
        when(clienteRepository.findByUsuarioId(USUARIO)).thenReturn(Optional.empty());
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO.valor())).thenReturn(Optional.of(perfil));

        assertThat(autorizacion.esParticipanteOAdmin(principal(Set.of(Rol.TECNICO), Rol.TECNICO), ot(asignado)))
                .isTrue();
    }

    private AuthenticatedUser principal(Set<Rol> roles, Rol rolPrincipal) {
        return new AuthenticatedUser(USUARIO, rolPrincipal, roles);
    }

    private Cliente cliente(ClienteId id) {
        Cliente cliente = mock(Cliente.class);
        when(cliente.getId()).thenReturn(id);
        return cliente;
    }

    private Tecnico tecnico(TecnicoId id) {
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getId()).thenReturn(id);
        return tecnico;
    }

    private OtResponse ot(TecnicoId tecnicoId) {
        Instant ahora = Instant.parse("2026-10-27T10:00:00Z");
        Ot ot = Ot.reconstituir(OtId.nueva(), CLIENTE_DUENO, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0),
                tecnicoId == null ? EstadoOt.BUSCANDO_TECNICO : EstadoOt.ASIGNADA, 10.0,
                ahora.plusSeconds(60), ahora, ahora, null, null, null, null, null, null);
        return OtResponse.fromDomain(ot);
    }
}
