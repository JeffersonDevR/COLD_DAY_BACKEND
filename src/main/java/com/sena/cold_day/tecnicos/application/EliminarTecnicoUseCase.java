package com.sena.cold_day.tecnicos.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;
import com.sena.cold_day.tecnicos.internal.domain.exception.TecnicoNoEncontradoException;

@Service
public class EliminarTecnicoUseCase {

	private final TecnicoRepository repository;

	public EliminarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public void eliminar(Long id) {
		Tecnico tecnico = repository.findById(id).filter(Tecnico::isActivo)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.setActivo(false);
		repository.saveAndFlush(tecnico);
	}
}
