package com.sena.cold_day.modules.tecnicos.application.usecases;

import org.springframework.stereotype.Service;

import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;


@Service
public class CambiarDisponibilidadUseCase {

	private final TecnicoRepository repository;

	public CambiarDisponibilidadUseCase(TecnicoRepository repository) {
		this.repository = repository;
	}

	public void cambiarEstado(Long id, EstadoOperativo nuevoEstado) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		tecnico.setEstadoOperativo(nuevoEstado);
		repository.save(tecnico);
	}
}
