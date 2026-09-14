package com.sena.cold_day.core.modules.ot.domain.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Source of truth for the OT state machine (SRS §5.2, design D1): every legal
 * transition is allowed, everything else raises
 * {@link TransicionOtInvalidaException}, and terminal states have no exits.
 */
class TransicionesOtTest {

    static Stream<Arguments> legalTransitions() {
        return Stream.of(
                Arguments.of(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO),
                Arguments.of(EstadoOt.BUSCANDO_TECNICO, EstadoOt.ASIGNADA),
                Arguments.of(EstadoOt.BUSCANDO_TECNICO, EstadoOt.SIN_TECNICOS_DISPONIBLES),
                Arguments.of(EstadoOt.BUSCANDO_TECNICO, EstadoOt.CANCELADA),
                Arguments.of(EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO),
                Arguments.of(EstadoOt.ASIGNADA, EstadoOt.CANCELADA),
                Arguments.of(EstadoOt.EN_CAMINO, EstadoOt.EN_DIAGNOSTICO),
                Arguments.of(EstadoOt.EN_CAMINO, EstadoOt.CANCELADA),
                Arguments.of(EstadoOt.EN_DIAGNOSTICO, EstadoOt.EN_REPARACION),
                Arguments.of(EstadoOt.EN_DIAGNOSTICO, EstadoOt.CANCELADA),
                Arguments.of(EstadoOt.EN_REPARACION, EstadoOt.FINALIZADA));
    }

    @ParameterizedTest(name = "{0} -> {1} is legal")
    @MethodSource("legalTransitions")
    void permitsEveryTransitionDefinedInTheStateMachine(EstadoOt origen, EstadoOt destino) {
        assertThatCode(() -> TransicionesOt.validar(origen, destino)).doesNotThrowAnyException();
    }

    @Test
    void rejectsTransitionsMissingFromTheStateMachine() {
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.SOLICITADA, EstadoOt.EN_REPARACION))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.SOLICITADA, EstadoOt.ASIGNADA))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.EN_REPARACION, EstadoOt.CANCELADA))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.ASIGNADA, EstadoOt.EN_DIAGNOSTICO))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.EN_CAMINO, EstadoOt.FINALIZADA))
                .isInstanceOf(TransicionOtInvalidaException.class);
    }

    @Test
    void terminalStatesHaveNoAllowedExit() {
        List<EstadoOt> terminales = List.of(EstadoOt.FINALIZADA, EstadoOt.CANCELADA,
                EstadoOt.SIN_TECNICOS_DISPONIBLES);

        for (EstadoOt terminal : terminales) {
            for (EstadoOt destino : EstadoOt.values()) {
                assertThatThrownBy(() -> TransicionesOt.validar(terminal, destino))
                        .as("%s -> %s must be rejected", terminal, destino)
                        .isInstanceOf(TransicionOtInvalidaException.class);
            }
        }
    }

    @Test
    void disputedStateIsIntentionallyAbsent() {
        assertThat(Arrays.stream(EstadoOt.values()).map(Enum::name)).doesNotContain("DISPUTADA");
    }

    @Test
    void marksTheThreeTerminalStates() {
        assertThat(EstadoOt.FINALIZADA.esTerminal()).isTrue();
        assertThat(EstadoOt.CANCELADA.esTerminal()).isTrue();
        assertThat(EstadoOt.SIN_TECNICOS_DISPONIBLES.esTerminal()).isTrue();
        assertThat(EstadoOt.SOLICITADA.esTerminal()).isFalse();
        assertThat(EstadoOt.BUSCANDO_TECNICO.esTerminal()).isFalse();
        assertThat(EstadoOt.ASIGNADA.esTerminal()).isFalse();
        assertThat(EstadoOt.EN_CAMINO.esTerminal()).isFalse();
        assertThat(EstadoOt.EN_DIAGNOSTICO.esTerminal()).isFalse();
        assertThat(EstadoOt.EN_REPARACION.esTerminal()).isFalse();
    }

    @Test
    void rejectsNullStates() {
        assertThatThrownBy(() -> TransicionesOt.validar(null, EstadoOt.SOLICITADA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TransicionesOt.validar(EstadoOt.SOLICITADA, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
