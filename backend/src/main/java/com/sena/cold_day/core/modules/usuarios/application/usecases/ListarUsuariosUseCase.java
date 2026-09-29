package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.application.mappers.UsuarioMapper;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;

/** Lists every usuario of the system (administrative view). */
@Service
public class ListarUsuariosUseCase {

    private final UsuarioRepository repository;
    private final UsuarioMapper mapper;

    public ListarUsuariosUseCase(UsuarioRepository repository, UsuarioMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listar() {
        return repository.listarTodos().stream().map(mapper::toResponse).toList();
    }
}
