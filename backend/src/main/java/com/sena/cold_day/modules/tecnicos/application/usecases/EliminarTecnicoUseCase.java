package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;


@Service
public class EliminarTecnicoUseCase {

	private final TecnicoRepository repository;

	public EliminarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public void eliminar(Long id) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.setActivo(false);
		repository.save(tecnico);
	}
}
