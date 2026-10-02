package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.services.TransicionesOt;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;

@Service
public class LimpiarOrdenesHuerfanasUseCase {

    private static final Logger log = LoggerFactory.getLogger(LimpiarOrdenesHuerfanasUseCase.class);
    private static final Set<EstadoOt> ESTADOS_CON_TECNICO_REQUERIDO = Set.of(
            EstadoOt.ASIGNADA,
            EstadoOt.EN_CAMINO,
            EstadoOt.EN_DIAGNOSTICO,
            EstadoOt.EN_REPARACION,
            EstadoOt.DISPUTADA);

    private final OtRepository otRepository;
    private final OfertaOtRepository ofertaRepository;
    private final TecnicoRepository tecnicoRepository;
    private final Clock clock;

    public LimpiarOrdenesHuerfanasUseCase(OtRepository otRepository, OfertaOtRepository ofertaRepository,
            TecnicoRepository tecnicoRepository, Clock clock) {
        this.otRepository = otRepository;
        this.ofertaRepository = ofertaRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clock = clock;
    }

    @Transactional
    public int ejecutar() {
        Instant ahora = clock.instant();
        int canceladas = 0;
        for (Ot ot : otRepository.listarTodas()) {
            if (!esHuerfana(ot)) {
                continue;
            }
            ot.cancelar(ActorOt.SISTEMA, MotivoCancelacion.LIMPIEZA_SISTEMA,
                    "Cancelada automaticamente: la OT no tiene un tecnico valido", ahora, null);
            otRepository.save(ot);
            ofertaRepository.invalidarPendientesDe(ot.getId(), OfertaEstado.CANCELADA, ahora);
            liberarTecnico(ot);
            log.warn("OT huerfana cancelada automaticamente: {}", ot.getId().valor());
            canceladas++;
        }
        return canceladas;
    }

    private boolean esHuerfana(Ot ot) {
        if (!ESTADOS_CON_TECNICO_REQUERIDO.contains(ot.getEstado())
                || !TransicionesOt.esPermitida(ot.getEstado(), EstadoOt.CANCELADA)) {
            return false;
        }
        if (ot.getTecnicoId() == null) {
            return true;
        }
        return tecnicoRepository.findByIdAndActivoTrue(ot.getTecnicoId()).isEmpty();
    }

    private void liberarTecnico(Ot ot) {
        if (ot.getTecnicoId() == null) {
            return;
        }
        tecnicoRepository.findByIdAndActivoTrue(ot.getTecnicoId()).ifPresent(tecnico -> {
            tecnico.liberarOrden();
            tecnicoRepository.save(tecnico);
        });
    }
}
