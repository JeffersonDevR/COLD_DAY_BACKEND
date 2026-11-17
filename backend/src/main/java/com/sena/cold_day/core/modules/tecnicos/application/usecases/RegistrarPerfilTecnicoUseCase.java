package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoPerfilRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoDuplicadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.PerfilNoAdquiribleException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Second-profile acquisition: an already authenticated usuario adds a technician
 * profile. The target usuario is the authenticated principal — never a path id
 * or body field — and the created role is determined solely by this endpoint
 * (TECNICO). On success the principal's {@code tokenVersion} is bumped, which
 * revokes the token in flight (design D3); the controller hands back the
 * replacement so the caller stays signed in with the new capability.
 *
 * <p>T4.3: la adopcion self-service solo la puede hacer quien se registro como
 * tecnico; los demas piden el cambio al administrador. El administrador adopta
 * perfiles con {@code desdeAdmin=true}, que saltea la puerta sin mutar el rol.
 */
@Service
public class RegistrarPerfilTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final TecnicoMapper mapper;

    public RegistrarPerfilTecnicoUseCase(TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository,
            TecnicoMapper mapper) {
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.mapper = mapper;
    }

    @Transactional
    public TecnicoResponse registrar(UsuarioId usuarioId, TecnicoPerfilRequest request) {
        return registrar(usuarioId, request, false);
    }

    /** {@code desdeAdmin=true} bypasses only the T4.3 initial-role gate. */
    @Transactional
    public TecnicoResponse registrar(UsuarioId usuarioId, TecnicoPerfilRequest request, boolean desdeAdmin) {
        Usuario usuario = usuarioRepository.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

        if (!desdeAdmin && usuario.getRol() != Rol.TECNICO) {
            throw new PerfilNoAdquiribleException();
        }

        // Any technician row blocks a duplicate, even a soft-deleted one.
        if (tecnicoRepository.findByUsuarioId(usuarioId.valor()).isPresent()) {
            throw new TecnicoDuplicadoException(usuarioId);
        }

        Tecnico tecnico = tecnicoRepository.save(Tecnico.crear(usuarioId.valor(),
                request.numeroIdentificacion(), request.categoriasServicio(), request.certificaciones()));

        // Revokes the in-flight token; the controller mints its replacement so the
        // caller does not have to sign in again.
        usuario.incrementarTokenVersion();
        usuarioRepository.save(usuario);

        return mapper.toResponse(usuario, tecnico);
    }
}
