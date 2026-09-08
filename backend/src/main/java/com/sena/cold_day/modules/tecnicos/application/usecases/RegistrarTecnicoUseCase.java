package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.events.TecnicoCreado;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;


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
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
		Tecnico saved = repository.save(tecnico);
		events.publishEvent(new TecnicoCreado(saved.getId()));
		return saved;
	}
}
