package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Budget presented to the client for approval (RF-F1-11/RF-F1-20, design D1).
 *
 * <p>PR5 ships this as part of the {@code ot} module skeleton; the aggregate
 * behaviour that consumes it ({@code presupuestar}, approval and rejection)
 * belongs to PR7.
 */
public record Presupuesto(
        BigDecimal costoManoObra,
        BigDecimal costoRepuestos,
        Instant emitidoEn) {

    public Presupuesto {
        Objects.requireNonNull(costoManoObra, "El costo de mano de obra es requerido");
        Objects.requireNonNull(costoRepuestos, "El costo de repuestos es requerido");
        Objects.requireNonNull(emitidoEn, "El momento de emision es requerido");
    }
}
