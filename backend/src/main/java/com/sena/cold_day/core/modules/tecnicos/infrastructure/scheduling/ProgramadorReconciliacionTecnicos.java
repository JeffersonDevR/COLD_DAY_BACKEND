package com.sena.cold_day.core.modules.tecnicos.infrastructure.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.tecnicos.application.usecases.ReconciliarTecnicosOcupadosUseCase;

@Component
public class ProgramadorReconciliacionTecnicos {

    private final ReconciliarTecnicosOcupadosUseCase reconciliarTecnicos;

    public ProgramadorReconciliacionTecnicos(ReconciliarTecnicosOcupadosUseCase reconciliarTecnicos) {
        this.reconciliarTecnicos = reconciliarTecnicos;
    }

    @Scheduled(fixedDelayString = "${app.tecnicos.reconciliacion-ms:60000}")
    public void reconciliar() {
        reconciliarTecnicos.ejecutar();
    }
}
