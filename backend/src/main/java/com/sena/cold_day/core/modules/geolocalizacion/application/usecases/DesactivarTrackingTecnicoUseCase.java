package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Stops real-time tracking for a technician once the service reaches a
 * terminal state, retaining the final coordinates for audit (RF-F1-27).
 */
@Service
public class DesactivarTrackingTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;

    public DesactivarTrackingTecnicoUseCase(TecnicoRepository tecnicoRepository) {
        this.tecnicoRepository = tecnicoRepository;
    }

    @Transactional
    public void desactivar(TecnicoId tecnicoId) {
        Tecnico tecnico = tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .orElseThrow(() -> new TecnicoNoEncontradoException(tecnicoId));
        tecnico.desactivarTracking();
        tecnicoRepository.save(tecnico);
    }
}
