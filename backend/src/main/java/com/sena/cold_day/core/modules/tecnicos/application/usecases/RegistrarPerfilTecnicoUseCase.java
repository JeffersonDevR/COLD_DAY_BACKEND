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
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Second-profile acquisition: an already authenticated usuario adds a technician
 * profile. The target usuario is the authenticated principal — never a path id
 * or body field — and the created role is determined solely by this endpoint
 * (TECNICO). On success the principal's {@code tokenVersion} is bumped, which
 * revokes the token in flight (design D3); the controller hands back the
 * replacement so the caller stays signed in with the new capability.
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
        Usuario usuario = usuarioRepository.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

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
