package com.sena.cold_day.tecnicos.application;

import java.util.List;

import org.springframework.stereotype.Service;

import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;
import com.sena.cold_day.tecnicos.internal.domain.exception.TecnicoNoEncontradoException;

@Service
public class BuscarTecnicoUseCase {

	private final TecnicoRepository repository;

	public BuscarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public List<Tecnico> listar() {
		return repository.findAll();
	}

	public Tecnico obtener(Long id) {
		return repository.findById(id).filter(Tecnico::isActivo)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
	}
}
