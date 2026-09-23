package com.sena.cold_day.core.modules.ot.domain.services;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.BandaTarifa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaEstimada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;

/**
 * Pure visit tariff calculator (design AD9). It holds no framework state: every
 * parameter arrives through the constructor, never from the database, so a
 * configuration change is enough to change the price and no migration is needed.
 *
 * <pre>
 * d &gt; radioMaxKm        -&gt; out of range (no finite tariff)
 * marginal = sum(rate_i * max(0, min(d, hasta_i) - desde_i))
 * tarifa   = min(base + marginal, precioMax)   // cap BEFORE rounding
 * tarifa   = round(tarifa / redondeoCop) * redondeoCop
 * </pre>
 */
public final class CalculadoraTarifaVisita {

    private final double base;
    private final double radioMetropolitanoKm;
    private final double radioMaxKm;
    private final BigDecimal precioMax;
    private final BigDecimal redondeoCop;
    private final List<BandaTarifa> bandas;

    public CalculadoraTarifaVisita(double base, double radioMetropolitanoKm, double radioMaxKm,
            BigDecimal precioMax, BigDecimal redondeoCop, List<BandaTarifa> bandas) {
        if (!Double.isFinite(base) || base < 0 || !Double.isFinite(radioMetropolitanoKm)
                || !Double.isFinite(radioMaxKm) || radioMetropolitanoKm < 0
                || radioMaxKm < radioMetropolitanoKm) {
            throw new IllegalArgumentException("Los radios y la base de la tarifa deben ser finitos y coherentes");
        }
        if (precioMax == null || precioMax.signum() < 0) {
            throw new IllegalArgumentException("El precio maximo debe ser no negativo");
        }
        if (redondeoCop == null || redondeoCop.signum() <= 0) {
            throw new IllegalArgumentException("El redondeo en COP debe ser positivo");
        }
        if (bandas == null || bandas.isEmpty()) {
            throw new IllegalArgumentException("La tarifa requiere al menos una banda");
        }
        this.base = base;
        this.radioMetropolitanoKm = radioMetropolitanoKm;
        this.radioMaxKm = radioMaxKm;
        this.precioMax = precioMax;
        this.redondeoCop = redondeoCop;
        this.bandas = List.copyOf(bandas);
    }

    /**
     * Computes the tariff for a distance in kilometres. The boundary
     * {@code distanciaKm == radioMetropolitanoKm} uses the flat base (inclusive).
     */
    public TarifaEstimada calcular(double distanciaKm, TarifaFuente fuente) {
        if (fuente == null) {
            throw new IllegalArgumentException("La fuente de la distancia es requerida");
        }
        if (!Double.isFinite(distanciaKm) || distanciaKm < 0) {
            throw new IllegalArgumentException("La distancia debe ser finita y no negativa");
        }
        if (distanciaKm > radioMaxKm) {
            return new TarifaEstimada(distanciaKm, fuente, null, null, true);
        }
        BigDecimal marginal = BigDecimal.ZERO;
        for (BandaTarifa banda : bandas) {
            double exceso = Math.min(distanciaKm, banda.hastaKm()) - banda.desdeKm();
            if (exceso > 0) {
                marginal = marginal.add(banda.rateCop().multiply(BigDecimal.valueOf(exceso)));
            }
        }
        BigDecimal bruto = BigDecimal.valueOf(base).add(marginal).min(precioMax);
        BigDecimal tarifa = bruto.divide(redondeoCop, 0, RoundingMode.HALF_UP).multiply(redondeoCop);
        return new TarifaEstimada(distanciaKm, fuente, bandaDe(distanciaKm), tarifa, false);
    }

    private int bandaDe(double distanciaKm) {
        if (distanciaKm <= radioMetropolitanoKm) {
            return 0;
        }
        for (int i = 0; i < bandas.size(); i++) {
            BandaTarifa banda = bandas.get(i);
            if (distanciaKm > banda.desdeKm() && distanciaKm <= banda.hastaKm()) {
                return i + 1;
            }
        }
        return bandas.size();
    }
}
