package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;

/**
 * Warns the technician, once, that the ETA the supplier committed to has elapsed
 * without the order being dispatched (design 2026-11-25). It carries no sanction:
 * the request keeps its state and nothing is re-broadcast; re-broadcasting is a
 * later feature. The warning is recorded before it is sent, so a failing push
 * never makes the same warning repeat on the next sweep.
 */
@Service
public class AvisarEtaVencidoUseCase {

    private static final Logger log = LoggerFactory.getLogger(AvisarEtaVencidoUseCase.class);

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final NotificacionInsumoPort notificacion;
    private final Clock clock;

    public AvisarEtaVencidoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            NotificacionInsumoPort notificacion, Clock clock) {
        this.requerimientoRepository = requerimientoRepository;
        this.notificacion = notificacion;
        this.clock = clock;
    }

    /** Returns how many technicians were warned in this sweep. */
    @Transactional
    public int ejecutar() {
        Instant ahora = clock.instant();
        List<RequerimientoInsumo> vencidos = requerimientoRepository.buscarEtaVencidos(ahora);
        int avisados = 0;
        for (RequerimientoInsumo requerimiento : vencidos) {
            // Conditional claim, not a save of the loaded copy: it matches nothing if the
            // supplier dispatched in between or the warning was already recorded.
            if (requerimientoRepository.marcarEtaAvisado(requerimiento.getId(), ahora) == 0) {
                continue;
            }
            NotificacionBestEffort.ejecutar(() -> notificacion.notificarEtaVencido(requerimiento), log,
                    "el ETA vencido de " + requerimiento.getId());
            avisados++;
        }
        return avisados;
    }
}
