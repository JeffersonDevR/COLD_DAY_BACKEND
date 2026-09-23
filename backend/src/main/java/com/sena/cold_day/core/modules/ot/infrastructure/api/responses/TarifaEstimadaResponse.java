package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.math.BigDecimal;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaEstimada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;

/**
 * Estimate response (design API Contracts). Out of range is HTTP 200 with
 * {@code fueraDeRango = true} and explicit {@code null} band and tariff — never
 * a sentinel such as {@code -1} or {@code 0}. {@code distanciaKm} and
 * {@code tarifaFuente} are always present.
 */
public record TarifaEstimadaResponse(
        double distanciaKm,
        TarifaFuente tarifaFuente,
        Integer banda,
        BigDecimal tarifa,
        boolean fueraDeRango) {

    public static TarifaEstimadaResponse de(TarifaEstimada estimada) {
        return new TarifaEstimadaResponse(estimada.distanciaKm(), estimada.tarifaFuente(),
                estimada.banda(), estimada.tarifa(), estimada.fueraDeRango());
    }
}
