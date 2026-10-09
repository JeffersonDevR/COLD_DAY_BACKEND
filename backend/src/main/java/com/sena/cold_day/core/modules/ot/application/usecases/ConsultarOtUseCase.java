package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
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
    private final Clock clock;

    public ConsultarOtUseCase(OtRepository otRepository, OtEstadoHistorialRepository historialRepository,
            TecnicoRepository tecnicoRepository, Clock clock) {
        this.otRepository = otRepository;
        this.historialRepository = historialRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clock = clock;
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
     * Last known location of the technician assigned to the OT (RF-F1-27 live
     * tracking). Empty when the OT has no technician, when the technician never
     * reported a position, or when the stored position is older than
     * {@link Tecnico#UBICACION_VIGENCIA}: a stale position is not reporting, so
     * the client must not keep drawing it. The coordinates themselves stay
     * persisted in the aggregate for audit.
     */
    @Transactional(readOnly = true)
    public Optional<Point> ubicacionTecnico(OtId id) {
        var ot = otRepository.buscarPorId(id).orElseThrow(() -> new OtNoEncontradoException(id));
        if (ot.getTecnicoId() == null) {
            return Optional.empty();
        }
        Instant ahora = clock.instant();
        return tecnicoRepository.findByIdAndActivoTrue(ot.getTecnicoId())
                .filter(tecnico -> tecnico.reportaUbicacionVigente(ahora))
                .map(Tecnico::getUbicacion);
    }
}
