package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

@Service
public class ReconciliarTecnicosOcupadosUseCase {

    private static final Logger log = LoggerFactory.getLogger(ReconciliarTecnicosOcupadosUseCase.class);
    private static final Set<EstadoOt> ESTADOS_OT_CON_SERVICIO_ACTIVO = Set.of(
            EstadoOt.ASIGNADA,
            EstadoOt.EN_CAMINO,
            EstadoOt.EN_DIAGNOSTICO,
            EstadoOt.EN_REPARACION,
            EstadoOt.DISPUTADA);

    private final TecnicoRepository tecnicoRepository;
    private final OtRepository otRepository;

    public ReconciliarTecnicosOcupadosUseCase(TecnicoRepository tecnicoRepository, OtRepository otRepository) {
        this.tecnicoRepository = tecnicoRepository;
        this.otRepository = otRepository;
    }

    @Transactional
    public int ejecutar() {
        int reconciliados = 0;
        for (Tecnico tecnico : tecnicoRepository.findByActivoTrue()) {
            if (tecnico.getEstadoOperativo() != EstadoOperativo.OCUPADO) {
                continue;
            }
            boolean tieneOrdenActiva = otRepository.buscarPorTecnico(tecnico.getId()).stream()
                    .map(Ot::getEstado)
                    .anyMatch(ESTADOS_OT_CON_SERVICIO_ACTIVO::contains);
            if (tieneOrdenActiva) {
                continue;
            }
            tecnico.liberarOrden();
            if (tecnico.getEstadoOperativo() == EstadoOperativo.DISPONIBLE) {
                tecnicoRepository.save(tecnico);
                log.warn("Tecnico {} liberado automaticamente: no tiene OT activa", tecnico.getId().valor());
                reconciliados++;
            }
        }
        return reconciliados;
    }
}
