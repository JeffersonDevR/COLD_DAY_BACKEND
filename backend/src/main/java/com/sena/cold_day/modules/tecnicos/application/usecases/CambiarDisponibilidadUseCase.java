package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import reactor.core.publisher.Mono;

@Service
public class CambiarDisponibilidadUseCase {

	private final TecnicoRepository repository;

	public CambiarDisponibilidadUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public Mono<Void> cambiarEstado(Long id, EstadoOperativo nuevoEstado) {
		return repository.findByIdAndActivoTrue(id)
				.switchIfEmpty(Mono.error(new TecnicoNoEncontradoException(id)))
				.flatMap(tecnico -> {
					tecnico.setEstadoOperativo(nuevoEstado);
					return repository.save(tecnico);
				})
				.then();
	}
}
