package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.application.dto.MiPerfilTecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Self-service update of the authenticated technician's specializations
 * (RF-F1-04). The profile is resolved from the principal's {@code usuarioId},
 * never from the request body, so the caller can only edit their own record.
 * Only service categories are in scope: identity fields are owned by Usuario
 * and email/password changes belong to their own flows.
 */
@Service
public class ActualizarMiPerfilTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final TecnicoMapper mapper;

    public ActualizarMiPerfilTecnicoUseCase(TecnicoRepository tecnicoRepository,
            UsuarioRepository usuarioRepository, TecnicoMapper mapper) {
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.mapper = mapper;
    }

    @Transactional
    public TecnicoResponse actualizar(UsuarioId usuarioId, MiPerfilTecnicoRequest request) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        Usuario usuario = usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId()))
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        tecnico.actualizarEspecialidades(request.categoriasServicio());
        tecnicoRepository.save(tecnico);
        return mapper.toResponse(usuario, tecnico);
    }
}
