package com.sena.cold_day.core.modules.ot.infrastructure.config;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

import com.sena.cold_day.core.modules.ot.domain.services.CalculadoraTarifaVisita;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.BandaTarifa;

/**
 * Visit tariff parameters (prefix {@code app.tarifa}, design AD9). The formula
 * and the brackets live only in configuration, never in the database, so
 * changing the pricing model needs no migration. Every value is overridable by
 * environment through the matching {@code application.properties} placeholder.
 */
@ConfigurationProperties(prefix = "app.tarifa")
public record TarifaProperties(double base, double radioMetropolitanoKm, double radioMaxKm,
        BigDecimal precioMax, BigDecimal redondeoCop, double centroLat, double centroLng,
        List<BandaTarifa> brackets) {

    public static final double BASE_POR_DEFECTO = 30000;
    public static final double RADIO_METROPOLITANO_POR_DEFECTO = 8.0;
    public static final double RADIO_MAX_POR_DEFECTO = 30.0;
    public static final BigDecimal PRECIO_MAX_POR_DEFECTO = new BigDecimal("80000");
    public static final BigDecimal REDONDEO_COP_POR_DEFECTO = new BigDecimal("100");
    public static final double CENTRO_LAT_POR_DEFECTO = 7.8939;
    public static final double CENTRO_LNG_POR_DEFECTO = -72.5078;

    public TarifaProperties {
        if (base <= 0) {
            base = BASE_POR_DEFECTO;
        }
        if (radioMetropolitanoKm <= 0) {
            radioMetropolitanoKm = RADIO_METROPOLITANO_POR_DEFECTO;
        }
        if (radioMaxKm <= 0) {
            radioMaxKm = RADIO_MAX_POR_DEFECTO;
        }
        if (precioMax == null || precioMax.signum() <= 0) {
            precioMax = PRECIO_MAX_POR_DEFECTO;
        }
        if (redondeoCop == null || redondeoCop.signum() <= 0) {
            redondeoCop = REDONDEO_COP_POR_DEFECTO;
        }
        if (centroLat == 0) {
            centroLat = CENTRO_LAT_POR_DEFECTO;
        }
        if (centroLng == 0) {
            centroLng = CENTRO_LNG_POR_DEFECTO;
        }
        if (brackets == null || brackets.isEmpty()) {
            brackets = List.of(
                    new BandaTarifa(radioMetropolitanoKm, 12, new BigDecimal("1800")),
                    new BandaTarifa(12, 18, new BigDecimal("2200")),
                    new BandaTarifa(18, 24, new BigDecimal("2600")),
                    new BandaTarifa(24, radioMaxKm, new BigDecimal("3200")));
        }
    }

    /** Adapts the configuration to the pure domain calculator. */
    public CalculadoraTarifaVisita aCalculadora() {
        return new CalculadoraTarifaVisita(base, radioMetropolitanoKm, radioMaxKm, precioMax, redondeoCop, brackets);
    }
}
