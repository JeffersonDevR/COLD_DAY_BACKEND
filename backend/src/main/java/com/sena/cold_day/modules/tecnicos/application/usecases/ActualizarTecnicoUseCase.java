package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.api.tecnicos.requests.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import reactor.core.publisher.Mono;

@Service
public class ActualizarTecnicoUseCase {

	private final TecnicoRepository repository;

	public ActualizarTecnicoUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public Mono<Tecnico> actualizar(Long id, TecnicoRequest request) {
		return repository.findByIdAndActivoTrue(id)
				.switchIfEmpty(Mono.error(new TecnicoNoEncontradoException(id)))
				.flatMap(tecnico -> {
					request.applyTo(tecnico);
					return repository.save(tecnico);
				});
	}
}
