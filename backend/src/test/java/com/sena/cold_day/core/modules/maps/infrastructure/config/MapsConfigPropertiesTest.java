package com.sena.cold_day.core.modules.maps.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Defaults of the map view configuration: they are the values the frontend used
 * to duplicate as literals, so a missing property must not change the map.
 */
class MapsConfigPropertiesTest {

    private MapsConfigProperties conDefaults() {
        return new MapsConfigProperties(null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    @Test
    void usaElCentroYLosLimitesDelAreaMetropolitana() {
        MapsConfigProperties properties = conDefaults();

        assertThat(properties.centroLat()).isEqualTo(7.8939);
        assertThat(properties.centroLng()).isEqualTo(-72.5078);
        assertThat(properties.boundsNorth()).isEqualTo(8.08);
        assertThat(properties.boundsSouth()).isEqualTo(7.76);
        assertThat(properties.boundsWest()).isEqualTo(-72.6);
        assertThat(properties.boundsEast()).isEqualTo(-72.41);
    }

    @Test
    void usaElZoomYLaEscalaDeRadiosPorDefecto() {
        MapsConfigProperties properties = conDefaults();

        assertThat(properties.zoom()).isEqualTo(13);
        assertThat(properties.radioInicialKm()).isEqualTo(10);
        assertThat(properties.radioMaxKm()).isEqualTo(25);
        assertThat(properties.radioPasoKm()).isEqualTo(5);
    }

    @Test
    void unaBrowserKeyVaciaNoSeExpone() {
        MapsConfigProperties properties = new MapsConfigProperties("  ", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

        assertThat(properties.browserApiKey()).isNull();
    }
}
