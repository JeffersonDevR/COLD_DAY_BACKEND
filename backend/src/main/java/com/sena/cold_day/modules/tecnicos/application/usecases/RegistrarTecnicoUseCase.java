package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.sena.cold_day.api.tecnicos.requests.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.events.TecnicoCreado;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;

import reactor.core.publisher.Mono;

@Service
public class RegistrarTecnicoUseCase {

	private final TecnicoRepository repository;
	private final ApplicationEventPublisher events;

	public RegistrarTecnicoUseCase(TecnicoRepository repository, ApplicationEventPublisher events) {
		this.repository = repository;
		this.events = events;
	}

	public Mono<Tecnico> registrar(TecnicoRequest request) {
		Tecnico tecnico = request.toEntity();
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);

		return repository.save(tecnico)
				.doOnSuccess(saved -> events.publishEvent(new TecnicoCreado(saved.getId())));
	}
}
