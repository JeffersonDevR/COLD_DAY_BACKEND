package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.shared.domain.Point;

/** Read paths for an OT and its append-only history (RNF-09). */
@Service
public class ConsultarOtUseCase {

    private final OtRepository otRepository;
    private final OtEstadoHistorialRepository historialRepository;
    private final TecnicoRepository tecnicoRepository;

    public ConsultarOtUseCase(OtRepository otRepository, OtEstadoHistorialRepository historialRepository,
            TecnicoRepository tecnicoRepository) {
        this.otRepository = otRepository;
        this.historialRepository = historialRepository;
        this.tecnicoRepository = tecnicoRepository;
    }

    @Transactional(readOnly = true)
    public OtResponse consultar(OtId id) {
        return otRepository.buscarPorId(id)
                .map(OtResponse::fromDomain)
                .orElseThrow(() -> new OtNoEncontradoException(id));
    }

    @Transactional(readOnly = true)
    public List<OtEstadoHistorial> historial(OtId id) {
        otRepository.buscarPorId(id).orElseThrow(() -> new OtNoEncontradoException(id));
        return historialRepository.listarPorOt(id);
    }

    /**
     * Última ubicación conocida del técnico asignado a la OT (RF-F1-27 live
     * tracking). Vacío si la OT no tiene técnico o éste no ha reportado posición.
     */
    @Transactional(readOnly = true)
    public Optional<Point> ubicacionTecnico(OtId id) {
        var ot = otRepository.buscarPorId(id).orElseThrow(() -> new OtNoEncontradoException(id));
        if (ot.getTecnicoId() == null) {
            return Optional.empty();
        }
        return tecnicoRepository.findByIdAndActivoTrue(ot.getTecnicoId())
                .map(Tecnico::getUbicacion)
                .filter(Objects::nonNull);
    }
}
