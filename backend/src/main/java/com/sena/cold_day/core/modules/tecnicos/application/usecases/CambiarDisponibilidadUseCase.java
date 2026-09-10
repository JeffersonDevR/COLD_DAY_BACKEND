package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;


@Service
public class CambiarDisponibilidadUseCase {

	private final TecnicoRepository repository;

	public CambiarDisponibilidadUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public void cambiarEstado(TecnicoId id, EstadoOperativo nuevoEstado) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.cambiarEstado(nuevoEstado);
		repository.save(tecnico);
	}
}
