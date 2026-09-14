package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** Read paths for an OT and its append-only history (RNF-09). */
@Service
public class ConsultarOtUseCase {

    private final OtRepository otRepository;
    private final OtEstadoHistorialRepository historialRepository;

    public ConsultarOtUseCase(OtRepository otRepository, OtEstadoHistorialRepository historialRepository) {
        this.otRepository = otRepository;
        this.historialRepository = historialRepository;
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
}
