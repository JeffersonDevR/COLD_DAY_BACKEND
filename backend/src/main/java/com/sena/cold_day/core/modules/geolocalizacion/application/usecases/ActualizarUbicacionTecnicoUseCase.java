package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Captures the authenticated technician's coordinates (RF-F1-06). The profile
 * is resolved from the principal's {@code usuarioId}, never from the body.
 * Range validation is enforced by {@link Point}.
 */
@Service
public class ActualizarUbicacionTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;

    public ActualizarUbicacionTecnicoUseCase(TecnicoRepository tecnicoRepository) {
        this.tecnicoRepository = tecnicoRepository;
    }

    @Transactional
    public void actualizar(UsuarioId usuarioId, Point ubicacion) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        tecnico.actualizarUbicacion(ubicacion, Instant.now());
        tecnicoRepository.save(tecnico);
    }
}
