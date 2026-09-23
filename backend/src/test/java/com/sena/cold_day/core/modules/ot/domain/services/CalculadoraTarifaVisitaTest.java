package com.sena.cold_day.core.modules.ot.domain.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaEstimada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;

/**
 * Source of truth for the visit tariff table (spec tar.R1-R3 and tar.R7;
 * design AD9): flat inclusive base, absolute-distance marginal brackets,
 * pre-rounding cap, COP rounding, band indexing and out-of-range handling.
 */
class CalculadoraTarifaVisitaTest {

    private static final CalculadoraTarifaVisita CALCULADORA = new TarifaProperties(30000, 8.0, 30.0,
            new BigDecimal("80000"), new BigDecimal("100"), 7.8939, -72.5078, null).aCalculadora();

    static Stream<Arguments> tarifasEsperadas() {
        return Stream.of(
                Arguments.of(3.0, "30000", 0),
                Arguments.of(8.0, "30000", 0),
                Arguments.of(8.0001, "30000", 1),
                Arguments.of(8.5, "30900", 1),
                Arguments.of(12.0, "37200", 1),
                Arguments.of(12.0001, "37200", 2),
                Arguments.of(18.0, "50400", 2),
                Arguments.of(18.0001, "50400", 3),
                Arguments.of(24.0, "66000", 3),
                Arguments.of(24.0001, "66000", 4),
                Arguments.of(28.375, "80000", 4),
                Arguments.of(30.0, "80000", 4));
    }

    @ParameterizedTest(name = "d={0} km -> {1} COP, banda {2}")
    @MethodSource("tarifasEsperadas")
    void cobraBaseYTramosMarginalesAbsolutos(double distanciaKm, String tarifaEsperada, int bandaEsperada) {
        TarifaEstimada estimada = CALCULADORA.calcular(distanciaKm, TarifaFuente.ROAD);

        assertThat(estimada.tarifa()).isEqualByComparingTo(tarifaEsperada);
        assertThat(estimada.banda()).isEqualTo(bandaEsperada);
        assertThat(estimada.fueraDeRango()).isFalse();
        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.ROAD);
    }

    @ParameterizedTest(name = "continuidad en {0} km")
    @ValueSource(doubles = { 8.0, 12.0, 18.0, 24.0 })
    void mantieneContinuidadEnCadaFronteraDeBanda(double frontera) {
        BigDecimal enFrontera = CALCULADORA.calcular(frontera, TarifaFuente.LINEAL).tarifa();

        assertThat(CALCULADORA.calcular(frontera - 1e-6, TarifaFuente.LINEAL).tarifa())
                .isEqualByComparingTo(enFrontera);
        assertThat(CALCULADORA.calcular(frontera + 1e-6, TarifaFuente.LINEAL).tarifa())
                .isEqualByComparingTo(enFrontera);
    }

    @Test
    void aplicaElTopeAntesDelRedondeo() {
        assertThat(CALCULADORA.calcular(28.3, TarifaFuente.ROAD).tarifa()).isEqualByComparingTo("79800");
        assertThat(CALCULADORA.calcular(28.375, TarifaFuente.ROAD).tarifa()).isEqualByComparingTo("80000");
        assertThat(CALCULADORA.calcular(30.0, TarifaFuente.ROAD).tarifa()).isEqualByComparingTo("80000");
    }

    @ParameterizedTest(name = "fuera de rango a {0} km")
    @ValueSource(doubles = { 30.0001, 45.0 })
    void marcaFueraDeRangoSinTarifaNiBanda(double distanciaKm) {
        TarifaEstimada estimada = CALCULADORA.calcular(distanciaKm, TarifaFuente.ROAD);

        assertThat(estimada.fueraDeRango()).isTrue();
        assertThat(estimada.tarifa()).isNull();
        assertThat(estimada.banda()).isNull();
        assertThat(estimada.distanciaKm()).isEqualTo(distanciaKm);
        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.ROAD);
    }

    @Test
    void redondeaAlMultiploDeCienCop() {
        assertThat(CALCULADORA.calcular(8.43, TarifaFuente.ROAD).tarifa()).isEqualByComparingTo("30800");
    }

    @Test
    void cambiaLaTarifaConSoloCambiarLaConfiguracion() {
        CalculadoraTarifaVisita conOtraBase = new TarifaProperties(35000, 8.0, 30.0,
                new BigDecimal("90000"), new BigDecimal("100"), 7.8939, -72.5078, null).aCalculadora();

        assertThat(conOtraBase.calcular(8.0, TarifaFuente.LINEAL).tarifa()).isEqualByComparingTo("35000");
        assertThat(conOtraBase.calcular(12.0, TarifaFuente.LINEAL).tarifa()).isEqualByComparingTo("42200");
    }

    @Test
    void declaraLosDefaultsEnLasPropiedades() {
        TarifaProperties propiedades = new TarifaProperties(0, 0, 0, null, null, 0, 0, null);

        assertThat(propiedades.base()).isEqualTo(30000);
        assertThat(propiedades.radioMetropolitanoKm()).isEqualTo(8.0);
        assertThat(propiedades.radioMaxKm()).isEqualTo(30.0);
        assertThat(propiedades.precioMax()).isEqualByComparingTo("80000");
        assertThat(propiedades.redondeoCop()).isEqualByComparingTo("100");
        assertThat(propiedades.brackets()).hasSize(4);
    }

    @Test
    void rechazaEntradasInvalidas() {
        assertThatThrownBy(() -> CALCULADORA.calcular(-1.0, TarifaFuente.ROAD))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CALCULADORA.calcular(5.0, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
