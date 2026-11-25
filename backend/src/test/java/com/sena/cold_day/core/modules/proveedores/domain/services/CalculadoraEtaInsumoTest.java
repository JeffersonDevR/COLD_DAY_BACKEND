package com.sena.cold_day.core.modules.proveedores.domain.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** ETA sugerido por distancia en linea recta y tope del ETA que el proveedor puede comprometer. */
class CalculadoraEtaInsumoTest {

    private final CalculadoraEtaInsumo calculadora = new CalculadoraEtaInsumo(30.0, 240);

    @Test
    void quinceKilometrosA30KmhSonTreintaMinutos() {
        assertThat(calculadora.sugerir(15.0)).isEqualTo(30);
    }

    @Test
    void distanciaMuyCortaDaMinimoUnMinuto() {
        assertThat(calculadora.sugerir(0.0)).isEqualTo(1);
        assertThat(calculadora.sugerir(0.1)).isEqualTo(1);
    }

    @Test
    void redondeaHaciaArriba() {
        // 10.1 km / 30 km/h = 20.2 min -> 21
        assertThat(calculadora.sugerir(10.1)).isEqualTo(21);
    }

    @Test
    void nuncaSuperaElTope() {
        assertThat(calculadora.sugerir(500.0)).isEqualTo(240);
    }

    @Test
    void validarAceptaElRangoCerrado() {
        assertThatCode(() -> calculadora.validar(1)).doesNotThrowAnyException();
        assertThatCode(() -> calculadora.validar(240)).doesNotThrowAnyException();
    }

    @Test
    void validarRechazaCeroNegativoYSobreTope() {
        assertThatThrownBy(() -> calculadora.validar(0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("entre 1 y 240");
        assertThatThrownBy(() -> calculadora.validar(-5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> calculadora.validar(241)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rechazaConfiguracionInvalida() {
        assertThatThrownBy(() -> new CalculadoraEtaInsumo(0.0, 240)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new CalculadoraEtaInsumo(30.0, 0)).isInstanceOf(IllegalArgumentException.class);
    }
}
