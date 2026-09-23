package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaEstimada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;

/**
 * Spec tar.R4/R5 (design AD10/D-c): the estimate uses the road distance and flags
 * {@code ROAD} when maps answers, falls back to Haversine with the configured
 * center and flags {@code LINEAL} otherwise, and stays out-of-range aware.
 */
@ExtendWith(MockitoExtension.class)
class EstimarTarifaUseCaseTest {

    private static final double CENTRO_LAT = 4.65;
    private static final double CENTRO_LNG = -74.05;

    @Mock MapsUseCase maps;

    private EstimarTarifaUseCase useCase(double centroLat, double centroLng) {
        TarifaProperties props = new TarifaProperties(30000, 8.0, 30.0, new BigDecimal("80000"),
                new BigDecimal("100"), centroLat, centroLng, null);
        return new EstimarTarifaUseCase(maps, props);
    }

    @Test
    void usaLaDistanciaVialYLaMarcaComoRoad() {
        when(maps.distanciaOpcional(CENTRO_LAT, CENTRO_LNG, 4.70, CENTRO_LNG))
                .thenReturn(Optional.of(new RutaCalculada(9.0, 20.0, "9.0 km", "20 min")));

        TarifaEstimada estimada = useCase(CENTRO_LAT, CENTRO_LNG).estimar(4.70, CENTRO_LNG);

        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.ROAD);
        assertThat(estimada.distanciaKm()).isEqualTo(9.0);
        assertThat(estimada.banda()).isEqualTo(1);
        assertThat(estimada.tarifa()).isEqualByComparingTo("31800");
        assertThat(estimada.fueraDeRango()).isFalse();
    }

    @Test
    void caeAHaversineConElCentroConfiguradoCuandoMapsDevuelveVacio() {
        when(maps.distanciaOpcional(CENTRO_LAT, CENTRO_LNG, CENTRO_LAT, CENTRO_LNG))
                .thenReturn(Optional.empty());

        TarifaEstimada estimada = useCase(CENTRO_LAT, CENTRO_LNG).estimar(CENTRO_LAT, CENTRO_LNG);

        verify(maps).distanciaOpcional(CENTRO_LAT, CENTRO_LNG, CENTRO_LAT, CENTRO_LNG);
        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
        assertThat(estimada.distanciaKm()).isZero();
        assertThat(estimada.banda()).isZero();
        assertThat(estimada.tarifa()).isEqualByComparingTo("30000");
    }

    @Test
    void usaElCentroPorDefectoCuandoLaConfiguracionNoLoDefine() {
        double lat = TarifaProperties.CENTRO_LAT_POR_DEFECTO;
        double lng = TarifaProperties.CENTRO_LNG_POR_DEFECTO;
        when(maps.distanciaOpcional(lat, lng, lat, lng)).thenReturn(Optional.empty());

        TarifaEstimada estimada = useCase(0, 0).estimar(lat, lng);

        verify(maps).distanciaOpcional(lat, lng, lat, lng);
        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
        assertThat(estimada.distanciaKm()).isZero();
    }

    @Test
    void mantieneElFueraDeRangoEnElFallbackLineal() {
        when(maps.distanciaOpcional(CENTRO_LAT, CENTRO_LNG, 0.0, 0.0)).thenReturn(Optional.empty());

        TarifaEstimada estimada = useCase(CENTRO_LAT, CENTRO_LNG).estimar(0.0, 0.0);

        assertThat(estimada.fueraDeRango()).isTrue();
        assertThat(estimada.banda()).isNull();
        assertThat(estimada.tarifa()).isNull();
        assertThat(estimada.tarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
    }
}
