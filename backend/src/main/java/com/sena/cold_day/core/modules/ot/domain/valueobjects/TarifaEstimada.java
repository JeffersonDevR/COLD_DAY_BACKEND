package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.math.BigDecimal;

/**
 * Result of the visit tariff calculation. Out of range carries no finite
 * tariff and no band ({@code banda} and {@code tarifa} are {@code null}),
 * while {@code distanciaKm} and {@code tarifaFuente} are always present.
 *
 * @param banda 0-based index of the highest bracket reached; {@code 0} means
 *              the flat metropolitan base, {@code null} only when out of range.
 */
public record TarifaEstimada(double distanciaKm, TarifaFuente tarifaFuente, Integer banda,
        BigDecimal tarifa, boolean fueraDeRango) {

    public TarifaEstimada {
        if (!Double.isFinite(distanciaKm) || distanciaKm < 0) {
            throw new IllegalArgumentException("La distancia debe ser finita y no negativa");
        }
        if (tarifaFuente == null) {
            throw new IllegalArgumentException("La fuente de la distancia es requerida");
        }
        if (fueraDeRango) {
            if (banda != null) {
                throw new IllegalArgumentException("Fuera de rango no tiene banda");
            }
            if (tarifa != null) {
                throw new IllegalArgumentException("Fuera de rango no tiene tarifa finita");
            }
        } else {
            if (banda == null || banda < 0) {
                throw new IllegalArgumentException("Una tarifa calculada requiere una banda valida");
            }
            if (tarifa == null || tarifa.signum() < 0) {
                throw new IllegalArgumentException("Una tarifa calculada requiere un monto no negativo");
            }
        }
    }
}
