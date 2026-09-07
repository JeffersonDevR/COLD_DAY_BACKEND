package com.sena.cold_day.tecnicos.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.tecnicos.internal.domain.EstadoOperativo;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;
import com.sena.cold_day.tecnicos.internal.domain.exception.TecnicoNoEncontradoException;

@Service
public class CambiarDisponibilidadUseCase {

	private final TecnicoRepository repository;

	public CambiarDisponibilidadUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public Tecnico cambiar(Long id, EstadoOperativo estadoOperativo) {
		Tecnico tecnico = repository.findById(id).filter(Tecnico::isActivo)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.setEstadoOperativo(estadoOperativo);
		return repository.save(tecnico);
	}
}
