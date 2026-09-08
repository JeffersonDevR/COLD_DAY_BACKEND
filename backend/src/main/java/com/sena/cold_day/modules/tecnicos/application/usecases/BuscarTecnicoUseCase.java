package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import java.util.List;

@Service
public class BuscarTecnicoUseCase {

	private final TecnicoRepository repository;

	public BuscarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public List<Tecnico> listar() {
		return repository.findByActivoTrue();
	}

	public Tecnico obtener(Long id) {
		return repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
	}
}
