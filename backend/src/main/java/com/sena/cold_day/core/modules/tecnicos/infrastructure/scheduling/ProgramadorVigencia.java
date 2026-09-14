package com.sena.cold_day.core.modules.tecnicos.infrastructure.scheduling;

import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.tecnicos.application.usecases.VerificarVigenciaDocumentalUseCase;

/**
 * Daily trigger for the documentary-vigencia sweep. Tests invoke
 * {@link VerificarVigenciaDocumentalUseCase#ejecutar(LocalDate)} directly with a
 * fixed date instead of waiting for the schedule.
 */
@Component
public class ProgramadorVigencia {

    private final VerificarVigenciaDocumentalUseCase verificarVigencia;

    public ProgramadorVigencia(VerificarVigenciaDocumentalUseCase verificarVigencia) {
        this.verificarVigencia = verificarVigencia;
    }

    @Scheduled(cron = "${app.vigencia.cron:0 0 6 * * *}")
    public void verificarVigenciaDocumental() {
        verificarVigencia.ejecutar(LocalDate.now(ZoneId.systemDefault()));
    }
}
