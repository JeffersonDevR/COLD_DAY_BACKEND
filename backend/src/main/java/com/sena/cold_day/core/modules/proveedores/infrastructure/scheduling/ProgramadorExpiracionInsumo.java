package com.sena.cold_day.core.modules.proveedores.infrastructure.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.proveedores.application.usecases.ExpirarInsumosUseCase;

/**
 * Server-authoritative expiry sweep (spec disp.R4, design AD6). Mirrors
 * {@code ProgramadorEscalamientoOt}: the delay is configurable so tests can push
 * it out of the way and drive expiry directly.
 *
 * <p>It delegates to {@link ExpirarInsumosUseCase} — the single sweep path — so
 * the orchestration and its transactional boundary live in the application
 * layer, not duplicated in the scheduler.
 */
@Component
public class ProgramadorExpiracionInsumo {

    private final ExpirarInsumosUseCase expirarInsumos;

    public ProgramadorExpiracionInsumo(ExpirarInsumosUseCase expirarInsumos) {
        this.expirarInsumos = expirarInsumos;
    }

    @Scheduled(fixedDelayString = "${app.insumos.barrido-ms:60000}")
    public void barrer() {
        expirarInsumos.expirar();
    }
}
