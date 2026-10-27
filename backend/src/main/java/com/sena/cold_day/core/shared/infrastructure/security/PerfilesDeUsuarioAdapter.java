package com.sena.cold_day.core.shared.infrastructure.security;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PerfilesDeUsuarioPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Resolves the profile ids of {@code GET /api/usuarios/me} (preparacion-ionic
 * B3), wired with the same repositories as {@link RolesDePerfilAdapter} so the
 * capability set and the profile map read the same source of truth:
 * technician profile is ACTIVE-only ({@code findByUsuarioIdAndActivoTrue});
 * cliente and proveedor existence use the same unmapped reads authorization
 * uses.
 *
 * <p>DTO discipline: only the scalar id leaves the module — no entity or
 * aggregate is ever copied across the boundary.
 */
@Component
public class PerfilesDeUsuarioAdapter implements PerfilesDeUsuarioPort {

    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ProveedorRepository proveedorRepository;

    public PerfilesDeUsuarioAdapter(ClienteRepository clienteRepository, TecnicoRepository tecnicoRepository,
            ProveedorRepository proveedorRepository) {
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.proveedorRepository = proveedorRepository;
    }

    @Override
    public PerfilesDeUsuario resolver(UsuarioId usuarioId) {
        Long id = usuarioId.valor();
        return new PerfilesDeUsuario(
                clienteRepository.findByUsuarioId(usuarioId)
                        .map(perfil -> perfil.getId().valor().toString()),
                tecnicoRepository.findByUsuarioIdAndActivoTrue(id)
                        .map(perfil -> perfil.getId().valor().toString()),
                proveedorRepository.findByUsuarioId(id)
                        .map(perfil -> perfil.getId().valor().toString()));
    }
}
