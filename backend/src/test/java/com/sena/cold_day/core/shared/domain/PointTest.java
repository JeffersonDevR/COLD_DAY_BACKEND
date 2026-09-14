package com.sena.cold_day.core.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Coordinate-range contract (RF-F1-06): latitude lives in [-90, 90] and
 * longitude in [-180, 180]. The previous implementation rejected any longitude
 * outside [-90, 90], which is wrong for the western hemisphere.
 */
class PointTest {

    @Test
    void acceptsLongitudesOutsideTheLatitudeRange() {
        Point sanFrancisco = new Point(37.7749, -122.4194);

        assertThat(sanFrancisco.latitud()).isEqualTo(37.7749);
        assertThat(sanFrancisco.longitud()).isEqualTo(-122.4194);
    }

    @Test
    void acceptsTheFullLongitudeAndLatitudeBoundaries() {
        assertThat(new Point(90, 180).longitud()).isEqualTo(180);
        assertThat(new Point(-90, -180).latitud()).isEqualTo(-90);
        assertThat(new Point(0, 120).longitud()).isEqualTo(120);
    }

    @Test
    void rejectsLatitudeOutOfRange() {
        assertThatThrownBy(() -> new Point(90.1, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("latitud");
        assertThatThrownBy(() -> new Point(-90.1, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("latitud");
    }

    @Test
    void rejectsLongitudeOutOfRange() {
        assertThatThrownBy(() -> new Point(0, 180.1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("longitud");
        assertThatThrownBy(() -> new Point(0, 200))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("longitud");
    }
}
