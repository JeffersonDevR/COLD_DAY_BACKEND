package com.sena.cold_day.core.modules.ot.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Aggregate behaviour of {@link Ot} (design D1/D2/D3): creation lands in
 * {@code SOLICITADA}, every accepted transition drains one immutable
 * {@link CambioEstado}, and illegal transitions leave the aggregate untouched.
 */
class OtTest {

    private static final ClienteId CLIENTE = ClienteId.nueva();
    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Test
    void creationStartsAsSolicitadaAndRecordsTheInitialState() {
        Ot ot = crear();

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.SOLICITADA);
        assertThat(ot.esTerminal()).isFalse();
        assertThat(ot.getClienteId()).isEqualTo(CLIENTE);
        assertThat(ot.getId()).isNotNull();
        assertThat(ot.getRadioKm()).isZero();
        assertThat(ot.getTecnicoId()).isNull();

        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isNull();
            assertThat(cambio.destino()).isEqualTo(EstadoOt.SOLICITADA);
            assertThat(cambio.actor()).isEqualTo(ActorOt.CLIENTE);
            assertThat(cambio.ocurridoEn()).isEqualTo(AHORA);
        });
    }

    @Test
    void iniciarBusquedaMovesToBuscandoTecnicoAndRecordsTheTransition() {
        Ot ot = crear();
        ot.drenarCambiosPendientes();

        ot.iniciarBusqueda(10.0, AHORA.plusSeconds(60), ActorOt.CLIENTE, AHORA);

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(ot.getRadioKm()).isEqualTo(10.0);
        assertThat(ot.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(60));

        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.SOLICITADA);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
            assertThat(cambio.actor()).isEqualTo(ActorOt.CLIENTE);
            assertThat(cambio.ocurridoEn()).isEqualTo(AHORA);
        });
    }

    @Test
    void illegalTransitionIsRejectedAndTheStateIsUnchanged() {
        Ot ot = crear();
        ot.drenarCambiosPendientes();

        assertThatThrownBy(() -> ot.finalizar(ActorOt.TECNICO, AHORA))
                .isInstanceOf(TransicionOtInvalidaException.class);

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.SOLICITADA);
        assertThat(ot.drenarCambiosPendientes()).isEmpty();
    }

    @Test
    void cancellationRecordsTheActorAndMotivoAttribution() {
        Ot ot = crearConBusqueda();

        ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.CANCELACION_CLIENTE, AHORA.plusSeconds(30));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(ot.esTerminal()).isTrue();
        assertThat(ot.getCanceladaPor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(ot.getMotivoCancelacion()).isEqualTo(MotivoCancelacion.CANCELACION_CLIENTE);

        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.CANCELADA);
            assertThat(cambio.actor()).isEqualTo(ActorOt.CLIENTE);
        });
    }

    @Test
    void agotarOpcionesReachesTheNegativeTerminalState() {
        Ot ot = crearConBusqueda();

        ot.agotarOpciones(ActorOt.SISTEMA, AHORA.plusSeconds(60));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES);
        assertThat(ot.esTerminal()).isTrue();
    }

    @Test
    void terminalStateRejectsFurtherTransitions() {
        Ot ot = crearConBusqueda();
        ot.agotarOpciones(ActorOt.SISTEMA, AHORA.plusSeconds(60));
        ot.drenarCambiosPendientes();

        assertThatThrownBy(() -> ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.CANCELACION_CLIENTE, AHORA))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES);
    }

    @Test
    void escalarRadioKeepsTheStateAndUpdatesTheWindow() {
        Ot ot = crearConBusqueda();
        ot.drenarCambiosPendientes();

        ot.escalarRadio(15.0, AHORA.plusSeconds(120), AHORA.plusSeconds(60));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(ot.getRadioKm()).isEqualTo(15.0);
        assertThat(ot.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(120));
        // Escalation does not change the state, so it is not a state change entry.
        assertThat(ot.drenarCambiosPendientes()).isEmpty();
    }

    @Test
    void drainingLeavesNoPendingTransitionBehind() {
        Ot ot = crear();
        ot.iniciarBusqueda(10.0, AHORA.plusSeconds(60), ActorOt.CLIENTE, AHORA);

        List<CambioEstado> pendientes = ot.drenarCambiosPendientes();

        assertThat(pendientes).hasSize(2);
        assertThat(pendientes).extracting(CambioEstado::destino)
                .containsExactly(EstadoOt.SOLICITADA, EstadoOt.BUSCANDO_TECNICO);
        assertThat(ot.drenarCambiosPendientes()).isEmpty();
    }

    @Test
    void creationRequiresMandatoryData() {
        assertThatThrownBy(() -> Ot.crear(null, CategoriaServicio.REFRIGERACION, "falla", List.of(),
                "Calle 1", new Point(4.6, -74.0), AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, null, "falla", List.of(),
                "Calle 1", new Point(4.6, -74.0), AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, CategoriaServicio.REFRIGERACION, " ",
                List.of(), "Calle 1", new Point(4.6, -74.0), AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, CategoriaServicio.REFRIGERACION, "falla",
                List.of(), "Calle 1", null, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Ot crear() {
        return Ot.crear(CLIENTE, CategoriaServicio.REFRIGERACION, "No enciende", List.of("http://foto"),
                "Calle 1", new Point(4.6, -74.0), AHORA);
    }

    private Ot crearConBusqueda() {
        Ot ot = crear();
        ot.iniciarBusqueda(10.0, AHORA.plusSeconds(60), ActorOt.CLIENTE, AHORA);
        ot.drenarCambiosPendientes();
        return ot;
    }
}
