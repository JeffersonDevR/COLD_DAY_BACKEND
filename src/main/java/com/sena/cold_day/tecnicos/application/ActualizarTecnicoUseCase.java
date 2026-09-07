package com.sena.cold_day.tecnicos.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.api.TecnicoRequest;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;
import com.sena.cold_day.tecnicos.internal.domain.exception.TecnicoNoEncontradoException;

@Service
public class ActualizarTecnicoUseCase {

	private final TecnicoRepository repository;

	public ActualizarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public Tecnico actualizar(Long id, TecnicoRequest request) {
		Tecnico tecnico = repository.findById(id).filter(Tecnico::isActivo)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		request.applyTo(tecnico);
		return repository.save(tecnico);
	}
}
