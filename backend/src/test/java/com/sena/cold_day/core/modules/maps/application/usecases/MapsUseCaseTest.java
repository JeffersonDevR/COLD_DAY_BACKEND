package com.sena.cold_day.core.modules.maps.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.maps.domain.exception.MapsNoDisponibleException;
import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;
import com.sena.cold_day.core.modules.maps.domain.services.MapsPort;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;

/**
 * Spec tar.R4 (design AD10): the non-throwing {@code distanciaOpcional} returns
 * the road distance when maps is usable and {@code Optional.empty()} — never a
 * 503 — when maps is disabled, unconfigured, has no route or fails.
 */
@ExtendWith(MockitoExtension.class)
class MapsUseCaseTest {

    private static final double OLAT = 7.8939;
    private static final double OLNG = -72.5078;

    @Mock MapsPort maps;

    private MapsUseCase useCase(String apiKey, boolean enabled) {
        return new MapsUseCase(maps, new MapsProperties(apiKey, enabled, "es", "CO", 4000));
    }

    @Test
    void devuelveLaDistanciaVialCuandoMapsEstaDisponible() {
        RutaCalculada ruta = new RutaCalculada(9.5, 18.0, "9.5 km", "18 min");
        when(maps.distancia(OLAT, OLNG, 8.0, -72.5)).thenReturn(Optional.of(ruta));

        assertThat(useCase("server-key", true).distanciaOpcional(OLAT, OLNG, 8.0, -72.5)).contains(ruta);
    }

    @Test
    void devuelveVacioCuandoMapsEstaDeshabilitado() {
        assertThat(useCase("server-key", false).distanciaOpcional(OLAT, OLNG, 8.0, -72.5)).isEmpty();

        verify(maps, never()).distancia(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void devuelveVacioCuandoMapsNoEstaConfigurado() {
        assertThat(useCase("  ", true).distanciaOpcional(OLAT, OLNG, 8.0, -72.5)).isEmpty();

        verify(maps, never()).distancia(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void devuelveVacioCuandoElPuertoNoEncuentraRuta() {
        when(maps.distancia(OLAT, OLNG, 8.0, -72.5)).thenReturn(Optional.empty());

        assertThat(useCase("server-key", true).distanciaOpcional(OLAT, OLNG, 8.0, -72.5)).isEmpty();
    }

    @Test
    void devuelveVacioYNoPropagaCuandoElPuertoFalla() {
        when(maps.distancia(OLAT, OLNG, 8.0, -72.5))
                .thenThrow(new IllegalStateException("Google no respondio"));

        assertThatCode(() -> useCase("server-key", true).distanciaOpcional(OLAT, OLNG, 8.0, -72.5))
                .doesNotThrowAnyException();
        assertThat(useCase("server-key", true).distanciaOpcional(OLAT, OLNG, 8.0, -72.5)).isEmpty();
    }

    @Test
    void laDistanciaExigenteConservaEl503CuandoMapsNoEstaDisponible() {
        assertThatThrownBy(() -> useCase("", true).distancia(OLAT, OLNG, 8.0, -72.5))
                .isInstanceOf(MapsNoDisponibleException.class);
    }

    @Test
    void estadoReflejaLaConfiguracion() {
        var estado = useCase("server-key", true).estado();

        assertThat(estado.enabled()).isTrue();
        assertThat(estado.configured()).isTrue();
        assertThat(estado.language()).isEqualTo("es");
        assertThat(estado.region()).isEqualTo("CO");
    }

    @Test
    void geocodificarRecortaLaEntradaYDelega() {
        DireccionGeocodificada direccion = new DireccionGeocodificada("Calle 1, Cúcuta", 7.8, -72.5, "pid");
        when(maps.geocodificar("Calle 1")).thenReturn(Optional.of(direccion));

        assertThat(useCase("server-key", true).geocodificar("  Calle 1  ")).contains(direccion);
        verify(maps).geocodificar("Calle 1");
    }

    @Test
    void geocodificarRechazaEntradaVacia() {
        assertThatThrownBy(() -> useCase("server-key", true).geocodificar("  "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> useCase("server-key", true).geocodificar(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void inversaValidaCoordenadasYDelega() {
        when(maps.inversa(7.8, -72.5))
                .thenReturn(Optional.of(new DireccionGeocodificada("Calle 1", 7.8, -72.5, null)));

        assertThat(useCase("server-key", true).inversa(7.8, -72.5)).isPresent();
        assertThatThrownBy(() -> useCase("server-key", true).inversa(120.0, -72.5))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void autocompletarValidaTextoYTransmiteLaUbicacionPreferida() {
        when(maps.autocompletar("Calle", 7.8, -72.5))
                .thenReturn(List.of(new SugerenciaDireccion("Calle 1", "pid")));

        assertThat(useCase("server-key", true).autocompletar(" Calle ", 7.8, -72.5)).hasSize(1);
        assertThatThrownBy(() -> useCase("server-key", true).autocompletar("ab", null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> useCase("server-key", true).autocompletar(null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void autocompletarPermiteBusquedaSinUbicacionPreferida() {
        when(maps.autocompletar("Calle", null, null)).thenReturn(List.of());

        assertThat(useCase("server-key", true).autocompletar("Calle", null, null)).isEmpty();
        verify(maps).autocompletar("Calle", null, null);
    }

    @Test
    void distanciaExigenteValidaAmbosPuntosYDelega() {
        when(maps.distancia(7.8, -72.5, 7.9, -72.6))
                .thenReturn(Optional.of(new RutaCalculada(1.5, 5.0, "1.5 km", "5 min")));

        assertThat(useCase("server-key", true).distancia(7.8, -72.5, 7.9, -72.6)).isPresent();
        assertThatThrownBy(() -> useCase("server-key", true).distancia(200.0, -72.5, 7.9, -72.6))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void operacionesExigentesFallaRapidoCuandoMapsEstaDeshabilitado() {
        MapsUseCase useCase = useCase("server-key", false);

        assertThatThrownBy(() -> useCase.geocodificar("Calle 1")).isInstanceOf(MapsNoDisponibleException.class);
        assertThatThrownBy(() -> useCase.inversa(7.8, -72.5)).isInstanceOf(MapsNoDisponibleException.class);
        assertThatThrownBy(() -> useCase.autocompletar("Calle", null, null))
                .isInstanceOf(MapsNoDisponibleException.class);
        assertThatThrownBy(() -> useCase.distancia(7.8, -72.5, 7.9, -72.6))
                .isInstanceOf(MapsNoDisponibleException.class);
    }

    @Test
    void operacionesExigentesFallaCuandoFaltaLaClave() {
        assertThatThrownBy(() -> useCase("  ", true).geocodificar("Calle 1"))
                .isInstanceOf(MapsNoDisponibleException.class);
    }
}
