package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import java.util.List;
import java.util.UUID;

@Service
public class BuscarTecnicoUseCase {

    private final TecnicoRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final TecnicoMapper mapper;

    public BuscarTecnicoUseCase(TecnicoRepository repository, UsuarioRepository usuarioRepository,
            TecnicoMapper mapper) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.mapper = mapper;
    }

    public List<TecnicoResponse> listar() {
        return repository.findByActivoTrue().stream()
                .map(this::combinar)
                .toList();
    }

    public TecnicoResponse obtener(TecnicoId id) {

        Tecnico tecnico = repository.findByIdAndActivoTrue(id)
                .orElseThrow(() -> new TecnicoNoEncontradoException(id));
        return combinar(tecnico);
    }

    private TecnicoResponse combinar(Tecnico tecnico) {
        Usuario usuario = usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId()))
                .orElseThrow(() -> new TecnicoNoEncontradoException(tecnico.getId()));
        return mapper.toResponse(usuario, tecnico);
    }
}
