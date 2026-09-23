package com.sena.cold_day.core.modules.maps.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.maps.domain.exception.MapsNoDisponibleException;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
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
}
