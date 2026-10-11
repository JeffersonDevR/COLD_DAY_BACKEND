package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.EnumSet;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.RolesDePerfilPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Derives the capability set from profile-row existence, wired with the same
 * repositories as {@link AutorizacionPropietario} so the capability set and the
 * ownership rules read the same source of truth.
 *
 * <p>Least privilege (M3): only CLIENTE, TECNICO and PROVEEDOR can be derived
 * here. ADMINISTRADOR and CONTABLE are never added — they exist in the result
 * only when they are already the {@code rolPrimario} carried by
 * {@code usuario.rol}. Nothing from the request body can influence this set.
 *
 * <p>Reads mirror the existing authorization semantics: technician capability is
 * ACTIVE-only ({@code findByUsuarioIdAndActivoTrue}); client and supplier
 * existence is read with the same methods {@link AutorizacionPropietario} uses.
 */
@Component
public class RolesDePerfilAdapter implements RolesDePerfilPort {

    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ProveedorRepository proveedorRepository;

    public RolesDePerfilAdapter(ClienteRepository clienteRepository, TecnicoRepository tecnicoRepository,
            ProveedorRepository proveedorRepository) {
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.proveedorRepository = proveedorRepository;
    }

    @Override
    public Set<Rol> resolver(UsuarioId usuarioId, Rol rolPrimario) {
        Set<Rol> roles = EnumSet.of(rolPrimario);
        if (clienteRepository.findByUsuarioId(usuarioId).isPresent()) {
            roles.add(Rol.CLIENTE);
        }
        if (tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor()).isPresent()) {
            roles.add(Rol.TECNICO);
        }
        if (proveedorRepository.findByUsuarioId(usuarioId.valor()).isPresent()) {
            roles.add(Rol.PROVEEDOR);
        }
        return Set.copyOf(roles);
    }
}
