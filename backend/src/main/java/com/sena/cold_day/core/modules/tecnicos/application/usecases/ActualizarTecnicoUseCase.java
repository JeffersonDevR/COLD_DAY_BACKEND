package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

@Service
public class ActualizarTecnicoUseCase {

    private final TecnicoRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final TecnicoMapper mapper;

    public ActualizarTecnicoUseCase(TecnicoRepository repository, UsuarioRepository usuarioRepository,
            TecnicoMapper mapper) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.mapper = mapper;
    }

    @Transactional
    public TecnicoResponse actualizar(TecnicoId id , TecnicoRequest request) {
        Tecnico tecnico = repository.findByIdAndActivoTrue(id)
                .orElseThrow(() -> new TecnicoNoEncontradoException(id));
        Usuario usuario = usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId()))
                .orElseThrow(() -> new TecnicoNoEncontradoException(id));
        mapper.apply(request, tecnico, usuario);
        repository.save(tecnico);
        usuarioRepository.save(usuario);
        return mapper.toResponse(usuario, tecnico);
    }
}
