package com.sena.cold_day.core.modules.ot.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Aggregate behaviour of {@link Ot} (design D1/D2/D3): creation lands in
 * {@code SOLICITADA}, every accepted transition drains one immutable
 * {@link CambioEstado}, and illegal transitions leave the aggregate untouched.
 */
class OtTest {

    private static final ClienteId CLIENTE = ClienteId.nueva();
    private static final TecnicoId TECNICO = TecnicoId.nueva();
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

        ot.escalarRadio(15.0, AHORA.plusSeconds(120));

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
        Point ubicacion = new Point(4.6, -74.0);
        assertThatThrownBy(() -> Ot.crear(null, CategoriaServicio.REFRIGERACION, "falla", List.of(),
                "Calle 1", ubicacion, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, null, "falla", List.of(),
                "Calle 1", ubicacion, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, CategoriaServicio.REFRIGERACION, " ",
                List.of(), "Calle 1", ubicacion, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Ot.crear(CLIENTE, CategoriaServicio.REFRIGERACION, "falla",
                List.of(), "Calle 1", null, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void iniciarDesplazamientoMovesFromAsignadaToEnCamino() {
        Ot ot = crearAsignada(AHORA);
        ot.drenarCambiosPendientes();

        ot.iniciarDesplazamiento(ActorOt.TECNICO, AHORA.plusSeconds(30));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.EN_CAMINO);
            assertThat(cambio.actor()).isEqualTo(ActorOt.TECNICO);
            assertThat(cambio.ocurridoEn()).isEqualTo(AHORA.plusSeconds(30));
        });
    }

    @Test
    void registrarDiagnosticoStoresTheFaultAndTheBudget() {
        Ot ot = crearEnCamino();
        ot.drenarCambiosPendientes();
        Diagnostico diagnostico = new Diagnostico("Compresor averiado", "Revisado en sitio",
                AHORA.plusSeconds(60));
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"),
                AHORA.plusSeconds(60));

        ot.registrarDiagnostico(diagnostico, ActorOt.TECNICO, AHORA.plusSeconds(60));
        ot.presupuestar(presupuesto);

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
        assertThat(ot.getDiagnostico()).isEqualTo(diagnostico);
        assertThat(ot.getPresupuesto()).isEqualTo(presupuesto);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.EN_CAMINO);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
            assertThat(cambio.actor()).isEqualTo(ActorOt.TECNICO);
        });
    }

    @Test
    void presupuestarRequiresTheDiagnosisState() {
        Ot ot = crearEnCamino();
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("1.00"), new BigDecimal("2.00"), AHORA);

        assertThatThrownBy(() -> ot.presupuestar(presupuesto))
                .isInstanceOf(IllegalStateException.class);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
    }

    @Test
    void registrarDiagnosticoRequiresEnCamino() {
        Ot ot = crearAsignada(AHORA);
        Diagnostico diagnostico = new Diagnostico("Falla", null, AHORA);

        assertThatThrownBy(() -> ot.registrarDiagnostico(diagnostico, ActorOt.TECNICO, AHORA))
                .isInstanceOf(TransicionOtInvalidaException.class);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
    }

    @Test
    void aprobarPresupuestoMovesToEnReparacion() {
        Ot ot = crearEnDiagnostico();
        ot.drenarCambiosPendientes();

        ot.aprobarPresupuesto(ActorOt.CLIENTE, AHORA.plusSeconds(120));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_REPARACION);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.EN_REPARACION);
            assertThat(cambio.actor()).isEqualTo(ActorOt.CLIENTE);
        });
    }

    @Test
    void theFreeCancellationWindowLastsTenMinutesFromAssignment() {
        Ot ot = crearAsignada(AHORA);

        assertThat(ot.dentroDeVentanaGratuita(AHORA.plusSeconds(9 * 60))).isTrue();
        assertThat(ot.dentroDeVentanaGratuita(AHORA.plusSeconds(600))).isTrue();
        assertThat(ot.dentroDeVentanaGratuita(AHORA.plusSeconds(601))).isFalse();
    }

    @Test
    void cancellationOutsideTheFreeWindowRecordsTheVisitFeeAndReason() {
        Ot ot = crearAsignada(AHORA);
        ot.drenarCambiosPendientes();

        ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.CANCELACION_CLIENTE, "Ya no la necesito",
                AHORA.plusSeconds(601), new BigDecimal("50000.00"));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(ot.getTarifaVisita()).isEqualByComparingTo("50000.00");
        assertThat(ot.getMotivoCancelacion()).isEqualTo(MotivoCancelacion.CANCELACION_CLIENTE);
        assertThat(ot.getCanceladaPor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(ot.drenarCambiosPendientes()).singleElement().satisfies(cambio -> {
            assertThat(cambio.origen()).isEqualTo(EstadoOt.ASIGNADA);
            assertThat(cambio.destino()).isEqualTo(EstadoOt.CANCELADA);
            assertThat(cambio.motivo()).isEqualTo("Ya no la necesito");
        });
    }

    @Test
    void cancellationInsideTheFreeWindowRecordsNoVisitFee() {
        Ot ot = crearAsignada(AHORA);

        ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.CANCELACION_CLIENTE, "Me arrepenti",
                AHORA.plusSeconds(120), null);

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(ot.getTarifaVisita()).isNull();
    }

    @Test
    void rejectionTerminatesAsCanceladaWithTheVisitFee() {
        Ot ot = crearEnDiagnostico();

        ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.RECHAZO_PRESUPUESTO, "Presupuesto muy alto",
                AHORA.plusSeconds(200), new BigDecimal("50000.00"));

        assertThat(ot.getEstado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(ot.getMotivoCancelacion()).isEqualTo(MotivoCancelacion.RECHAZO_PRESUPUESTO);
        assertThat(ot.getTarifaVisita()).isEqualByComparingTo("50000.00");
    }

    @Test
    void legacyReconstitutionDefaultsTheAuxiliarCountToZero() {
        Ot ot = crearAsignada(AHORA);

        assertThat(ot.getAuxiliaresRequeridos()).isZero();
    }

    @Test
    void reconstitutionKeepsThePersistedAuxiliarCount() {
        Ot ot = reconstituirConAuxiliares(3);

        assertThat(ot.getAuxiliaresRequeridos()).isEqualTo(3);
    }

    @Test
    void reconstitutionMapsANullAuxiliarCountToZeroDefensively() {
        Ot ot = reconstituirConAuxiliares(null);

        assertThat(ot.getAuxiliaresRequeridos()).isZero();
    }

    private Ot reconstituirConAuxiliares(Integer auxiliaresRequeridos) {
        return Ot.reconstituir(OtId.nueva(), CLIENTE, TECNICO, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.ASIGNADA, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, null, null, null,
                auxiliaresRequeridos);
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

    private Ot crearAsignada(Instant asignadaEn) {
        return Ot.reconstituir(OtId.nueva(), CLIENTE, TECNICO, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.ASIGNADA, 10.0,
                AHORA.plusSeconds(60), AHORA, asignadaEn, null, null, null, null, null, null);
    }

    private Ot crearEnCamino() {
        Ot ot = crearAsignada(AHORA);
        ot.iniciarDesplazamiento(ActorOt.TECNICO, AHORA.plusSeconds(30));
        return ot;
    }

    private Ot crearEnDiagnostico() {
        Ot ot = crearEnCamino();
        ot.registrarDiagnostico(new Diagnostico("Compresor averiado", null, AHORA.plusSeconds(60)),
                ActorOt.TECNICO, AHORA.plusSeconds(60));
        ot.presupuestar(new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"),
                AHORA.plusSeconds(60)));
        return ot;
    }
}
