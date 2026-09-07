package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import reactor.core.publisher.Mono;

@Service
public class EliminarTecnicoUseCase {

	private final TecnicoRepository repository;

	public EliminarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public Mono<Void> eliminar(Long id) {
		return repository.findByIdAndActivoTrue(id)
				.switchIfEmpty(Mono.error(new TecnicoNoEncontradoException(id)))
				.flatMap(tecnico -> {
					tecnico.setActivo(false);
					return repository.save(tecnico);
				})
				.then();
	}
}
