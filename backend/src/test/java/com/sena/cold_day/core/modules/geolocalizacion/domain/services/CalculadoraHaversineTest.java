package com.sena.cold_day.core.modules.geolocalizacion.domain.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.shared.domain.Point;

/**
 * Pure Haversine distance contract used by the spatial availability port
 * (RF-F1-07). Distances are expressed in kilometres.
 */
class CalculadoraHaversineTest {

    private static final double KM = 1.0;

    @Test
    void returnsZeroForTheSamePoint() {
        Point bogota = new Point(4.7110, -74.0721);

        assertThat(CalculadoraHaversine.distanciaKm(bogota, bogota)).isEqualTo(0.0);
    }

    @Test
    void oneLongitudeDegreeAtTheEquatorIsAboutOneHundredElevenKm() {
        double distancia = CalculadoraHaversine.distanciaKm(new Point(0, 0), new Point(0, 1));

        assertThat(distancia).isCloseTo(111.19, within(KM));
    }

    @Test
    void computesTheDistanceBetweenBogotaAndMedellin() {
        double distancia = CalculadoraHaversine.distanciaKm(
                new Point(4.7110, -74.0721), new Point(6.2442, -75.5812));

        assertThat(distancia).isCloseTo(238.67, within(KM));
    }

    @Test
    void isSymmetric() {
        Point bogota = new Point(4.7110, -74.0721);
        Point medellin = new Point(6.2442, -75.5812);

        assertThat(CalculadoraHaversine.distanciaKm(bogota, medellin))
                .isEqualTo(CalculadoraHaversine.distanciaKm(medellin, bogota));
    }
}
