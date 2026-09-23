package com.sena.cold_day.core.modules.ot.application.dto;

import java.math.BigDecimal;
import java.util.List;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;

/**
 * Application-level input for recording a diagnosis and its budget (RF-F1-11).
 * The detected fault and the labor/parts costs travel together because the
 * client receives the budget as soon as the diagnosis is recorded. The optional
 * {@code insumos} lines are the technician's insumo declarations (spec disp.R1);
 * they are dispatched separately and never embedded in the persisted diagnosis
 * (design AD5).
 */
public record DiagnosticoRequest(
        String fallaDetectada,
        String observaciones,
        BigDecimal costoManoObra,
        BigDecimal costoRepuestos,
        List<InsumoLinea> insumos) {

    /** Legacy 4-arg form: no insumo lines declared. */
    public DiagnosticoRequest(String fallaDetectada, String observaciones, BigDecimal costoManoObra,
            BigDecimal costoRepuestos) {
        this(fallaDetectada, observaciones, costoManoObra, costoRepuestos, List.of());
    }
}
