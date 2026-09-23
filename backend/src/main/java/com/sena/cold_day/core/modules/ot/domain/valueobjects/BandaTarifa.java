package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.math.BigDecimal;

/**
 * Absolute-distance marginal bracket, half-open {@code [desdeKm, hastaKm)}.
 * The bracket only charges {@code rateCop} per km on the portion of the
 * distance that falls inside it, so contiguous brackets keep the tariff
 * continuous at every shared endpoint.
 */
public record BandaTarifa(double desdeKm, double hastaKm, BigDecimal rateCop) {

    public BandaTarifa {
        if (!Double.isFinite(desdeKm) || desdeKm < 0) {
            throw new IllegalArgumentException("El limite inferior de la banda debe ser finito y no negativo");
        }
        if (!Double.isFinite(hastaKm) || hastaKm <= desdeKm) {
            throw new IllegalArgumentException("El limite superior de la banda debe superar al inferior");
        }
        if (rateCop == null || rateCop.signum() < 0) {
            throw new IllegalArgumentException("La tarifa por kilometro debe ser no negativa");
        }
    }
}
