package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.time.Instant;
import java.util.Objects;

/**
 * Diagnosis recorded by the assigned technician (RF-F1-11, design D1).
 *
 * <p>PR5 ships this as part of the {@code ot} module skeleton; the aggregate
 * behaviour that consumes it ({@code registrarDiagnostico}) belongs to PR7.
 */
public record Diagnostico(
        String fallaDetectada,
        String observaciones,
        Instant registradoEn) {

    public Diagnostico {
        Objects.requireNonNull(fallaDetectada, "La falla detectada es requerida");
        Objects.requireNonNull(registradoEn, "El momento del diagnostico es requerido");
    }
}
