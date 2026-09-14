package com.sena.cold_day.core.modules.ot.infrastructure.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.ot.application.usecases.EscalarRadioUseCase;

/**
 * Trigger for the dispatch radius escalation sweep (design D6). The delay is
 * configurable so tests can disable it; tests invoke
 * {@link EscalarRadioUseCase#ejecutar()} directly with a fixed clock instead of
 * waiting for the schedule.
 */
@Component
public class ProgramadorEscalamientoOt {

    private final EscalarRadioUseCase escalarRadio;

    public ProgramadorEscalamientoOt(EscalarRadioUseCase escalarRadio) {
        this.escalarRadio = escalarRadio;
    }

    @Scheduled(fixedDelayString = "${app.dispatch.escalamiento-ms:5000}")
    public void escalar() {
        escalarRadio.ejecutar();
    }
}
