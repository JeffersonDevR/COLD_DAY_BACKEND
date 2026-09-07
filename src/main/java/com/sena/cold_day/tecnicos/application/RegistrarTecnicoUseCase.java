package com.sena.cold_day.tecnicos.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.api.TecnicoCreado;
import com.sena.cold_day.tecnicos.api.TecnicoRequest;
import com.sena.cold_day.tecnicos.internal.domain.EstadoOperativo;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;
import com.sena.cold_day.tecnicos.internal.domain.exception.NumeroIdentificacionDuplicadoException;

@Service
public class RegistrarTecnicoUseCase {

	private final TecnicoRepository repository;
	private final ApplicationEventPublisher events;

	public RegistrarTecnicoUseCase(TecnicoRepository repository, ApplicationEventPublisher events) {
		this.repository = repository;
		this.events = events;
	}

	@Transactional
	public Tecnico registrar(TecnicoRequest request) {
		Tecnico tecnico = request.toEntity();
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
		tecnico.setActivo(true);
		try {
			tecnico = repository.saveAndFlush(tecnico);
		} catch (DataIntegrityViolationException exception) {
			throw new NumeroIdentificacionDuplicadoException(request.numeroIdentificacion());
		}
		events.publishEvent(new TecnicoCreado(tecnico.getId()));
		return tecnico;
	}
}
