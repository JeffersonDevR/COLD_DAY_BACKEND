package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class BuscarTecnicoUseCase {

	private final TecnicoRepository repository;

	public BuscarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public Flux<Tecnico> listar() {
		return repository.findByActivoTrue();
	}

	public Mono<Tecnico> obtener(Long id) {
		return repository.findByIdAndActivoTrue(id)
				.switchIfEmpty(Mono.error(new TecnicoNoEncontradoException(id)));
	}
}
