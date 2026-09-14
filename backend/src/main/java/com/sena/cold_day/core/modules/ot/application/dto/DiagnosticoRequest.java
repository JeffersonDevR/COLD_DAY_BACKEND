package com.sena.cold_day.core.modules.ot.application.dto;

import java.math.BigDecimal;

/**
 * Application-level input for recording a diagnosis and its budget (RF-F1-11).
 * The detected fault and the labor/parts costs travel together because the
 * client receives the budget as soon as the diagnosis is recorded.
 */
public record DiagnosticoRequest(
        String fallaDetectada,
        String observaciones,
        BigDecimal costoManoObra,
        BigDecimal costoRepuestos) {
}
