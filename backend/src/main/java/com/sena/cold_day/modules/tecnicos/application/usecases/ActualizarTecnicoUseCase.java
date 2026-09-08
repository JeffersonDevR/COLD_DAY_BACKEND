package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;


@Service
public class ActualizarTecnicoUseCase {

	private final TecnicoRepository repository;
	private final TecnicoMapper mapper;

	public ActualizarTecnicoUseCase(TecnicoRepository repository, TecnicoMapper mapper) {
		this.repository = repository;
		this.mapper = mapper;
	}

	public Tecnico actualizar(Long id, TecnicoRequest request) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		mapper.apply(request, tecnico);
		return repository.save(tecnico);
	}
}
