package com.sena.cold_day.core.modules.proveedores.infrastructure.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.proveedores.application.usecases.AvisarEtaVencidoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.EscalarRadioInsumosUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ExpirarInsumosUseCase;

/**
 * Server-authoritative expiry sweep (spec disp.R4, design AD6). Mirrors
 * {@code ProgramadorEscalamientoOt}: the delay is configurable so tests can push
 * it out of the way and drive expiry directly.
 *
 * <p>One sweep path, two steps: first it widens the radius of every request whose
 * window closed ({@link EscalarRadioInsumosUseCase}), then it closes what expired
 * ({@link ExpirarInsumosUseCase}) and finally warns the technicians whose supplier
 * let the committed ETA pass ({@link AvisarEtaVencidoUseCase}). The orchestration and its transactional
 * boundaries live in the application layer, not duplicated in the scheduler.
 */
@Component
public class ProgramadorExpiracionInsumo {

    private final EscalarRadioInsumosUseCase escalarRadio;
    private final ExpirarInsumosUseCase expirarInsumos;
    private final AvisarEtaVencidoUseCase avisarEtaVencido;

    public ProgramadorExpiracionInsumo(EscalarRadioInsumosUseCase escalarRadio,
            ExpirarInsumosUseCase expirarInsumos, AvisarEtaVencidoUseCase avisarEtaVencido) {
        this.escalarRadio = escalarRadio;
        this.expirarInsumos = expirarInsumos;
        this.avisarEtaVencido = avisarEtaVencido;
    }

    @Scheduled(fixedDelayString = "${app.insumos.barrido-ms:15000}")
    public void barrer() {
        escalarRadio.ejecutar();
        expirarInsumos.expirar();
        avisarEtaVencido.ejecutar();
    }
}
