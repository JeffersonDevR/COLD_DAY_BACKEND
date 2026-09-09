package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoCreado;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;


@Service
public class RegistrarTecnicoUseCase {

	private final TecnicoRepository repository;
	private final ApplicationEventPublisher events;
	private final TecnicoMapper mapper;

	public RegistrarTecnicoUseCase(TecnicoRepository repository, ApplicationEventPublisher events, TecnicoMapper mapper) {
		this.repository = repository;
		this.events = events;
		this.mapper = mapper;
	}

	public Tecnico registrar(TecnicoRequest request) {
		Tecnico tecnico = mapper.toDomain(request);
		Tecnico saved = repository.save(tecnico);
		events.publishEvent(new TecnicoCreado(saved.getId()));
		return saved;
	}
}
