package com.sena.cold_day.core.modules.proveedores.infrastructure.scheduling;

import java.time.Clock;
import java.time.Instant;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;

/**
 * Server-authoritative expiry sweep (spec disp.R4, design AD6). Mirrors
 * {@code ProgramadorEscalamientoOt}: the delay is configurable so tests can push
 * it out of the way and drive expiry directly. It closes every pending offer
 * whose window passed and resolves every still-open request to
 * {@code SIN_PROVEEDOR} without ever touching the OT lifecycle.
 *
 * <p>The sweep is a persistence-level primitive (conditional bulk UPDATEs, like
 * {@code OfertaOtRepository.expirarDe}); the richer orchestration lives in the
 * dispatch use cases.
 */
@Component
public class ProgramadorExpiracionInsumo {

    private final OfertaInsumoRepository ofertaRepository;
    private final RequerimientoInsumoRepository requerimientoRepository;
    private final Clock clock;

    public ProgramadorExpiracionInsumo(OfertaInsumoRepository ofertaRepository,
            RequerimientoInsumoRepository requerimientoRepository, Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.requerimientoRepository = requerimientoRepository;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${app.insumos.barrido-ms:60000}")
    public void barrer() {
        Instant ahora = clock.instant();
        ofertaRepository.expirarVencidas(ahora);
        requerimientoRepository.expirarVencidos(ahora);
    }
}
