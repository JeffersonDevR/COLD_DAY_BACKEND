package com.sena.cold_day.core.modules.ot.infrastructure.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.ot.application.usecases.LimpiarOrdenesHuerfanasUseCase;

@Component
public class ProgramadorLimpiezaOrdenesHuerfanas {

    private final LimpiarOrdenesHuerfanasUseCase limpiarOrdenes;

    public ProgramadorLimpiezaOrdenesHuerfanas(LimpiarOrdenesHuerfanasUseCase limpiarOrdenes) {
        this.limpiarOrdenes = limpiarOrdenes;
    }

    @Scheduled(fixedDelayString = "${app.ot.limpieza-huerfanos-ms:300000}")
    public void limpiar() {
        limpiarOrdenes.ejecutar();
    }
}
