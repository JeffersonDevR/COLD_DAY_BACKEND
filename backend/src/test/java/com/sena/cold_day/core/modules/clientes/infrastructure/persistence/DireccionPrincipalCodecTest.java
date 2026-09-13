package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.shared.domain.Point;

class DireccionPrincipalCodecTest {

    @Test
    void roundTripsSeparatorInsideEveryComponent() {
        DireccionPrincipal original = DireccionPrincipal.sinUbicacion(
                "Calle | 1", "Bogo|ta", "Cen|tro");

        String encoded = DireccionPrincipalCodec.encode(original);

        assertThat(DireccionPrincipalCodec.decode(encoded, null, null)).isEqualTo(original);
    }

    @Test
    void roundTripsLiteralBackslashEscapeCharacter() {
        DireccionPrincipal original = DireccionPrincipal.sinUbicacion(
                "Calle \\ 1", "Bogota", "Cen\\tro");

        String encoded = DireccionPrincipalCodec.encode(original);

        assertThat(DireccionPrincipalCodec.decode(encoded, null, null)).isEqualTo(original);
    }

    @Test
    void roundTripsCombinedBackslashAndSeparator() {
        DireccionPrincipal original = DireccionPrincipal.sinUbicacion(
                "Calle", "Bogota", "Cen\\|tro");

        String encoded = DireccionPrincipalCodec.encode(original);

        assertThat(DireccionPrincipalCodec.decode(encoded, null, null)).isEqualTo(original);
    }

    @Test
    void decodesBlankBarrioBackToNull() {
        DireccionPrincipal original = DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", null);

        String encoded = DireccionPrincipalCodec.encode(original);

        assertThat(DireccionPrincipalCodec.decode(encoded, null, null).getBarrio()).isNull();
    }

    @Test
    void reattachesLocationWhenCoordinatesArePresent() {
        DireccionPrincipal original = DireccionPrincipal.con(
                "Calle 1", "Bogota", "Centro", new Point(4.6, -74.0));

        String encoded = DireccionPrincipalCodec.encode(original);
        DireccionPrincipal decoded = DireccionPrincipalCodec.decode(encoded, 4.6, -74.0);

        assertThat(decoded).isEqualTo(original);
        assertThat(decoded.tieneUbicacion()).isTrue();
    }

    @Test
    void returnsNullForNullOrBlankAddress() {
        assertThat(DireccionPrincipalCodec.encode(null)).isNull();
        assertThat(DireccionPrincipalCodec.decode(null, null, null)).isNull();
        assertThat(DireccionPrincipalCodec.decode("  ", null, null)).isNull();
    }

    @Test
    void rejectsMalformedEncodedAddress() {
        assertThatThrownBy(() -> DireccionPrincipalCodec.decode("solo|dos", null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DireccionPrincipalCodec.decode("a|b|\\", null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
