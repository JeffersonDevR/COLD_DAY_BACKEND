package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoBloqueadoPorLiquidacionException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;


@Service
public class CambiarDisponibilidadUseCase {

	private final TecnicoRepository repository;
	private final LiquidacionRepository liquidaciones;

	public CambiarDisponibilidadUseCase(TecnicoRepository repository, LiquidacionRepository liquidaciones) {
		this.repository = repository;
		this.liquidaciones = liquidaciones;
	}

	public void cambiarEstado(TecnicoId id, EstadoOperativo nuevoEstado) {
		Tecnico tecnico = repository.findByIdAndActivoTrue(id)
				.orElseThrow(() -> new TecnicoNoEncontradoException(id));
		// La deuda manda sobre el estado: pasar por «fuera de servicio» no la borra.
		if (nuevoEstado == EstadoOperativo.DISPONIBLE && liquidaciones.existeBloqueadoraPara(id)) {
			throw new TecnicoBloqueadoPorLiquidacionException();
		}
		tecnico.cambiarEstado(nuevoEstado);
		repository.save(tecnico);
	}
}
