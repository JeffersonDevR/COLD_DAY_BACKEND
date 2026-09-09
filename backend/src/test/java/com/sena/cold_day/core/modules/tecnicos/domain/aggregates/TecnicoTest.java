package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;

class TecnicoTest {

    @Test
    void startsPendingAndOutOfServiceUntilApproved() {
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(CategoriaServicio.REFRIGERACION), Set.of());

        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);
        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.PENDIENTE);
        assertThat(tecnico.getUsuarioId()).isEqualTo(7L);
        assertThat(tecnico.getCategoriasServicio()).containsExactly(CategoriaServicio.REFRIGERACION);
        assertThatThrownBy(() -> tecnico.getCategoriasServicio().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void theValidationGateBlocksOperativeChangesBeforeApproval() {
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(), Set.of());

        assertThatThrownBy(() -> tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE))
                .isInstanceOf(TecnicoNoValidadoException.class);
        assertThatThrownBy(tecnico::aceptarOrden)
                .isInstanceOf(TecnicoNoValidadoException.class);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);
    }

    @Test
    void approvalUnblocksTheOperativeStateButKeepsItOutOfService() {
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(), Set.of());

        tecnico.aprobarValidacion();

        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.APROBADO);
        assertThat(tecnico.getMotivoRechazoValidacion()).isNull();
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);

        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);

        tecnico.aceptarOrden();
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.OCUPADO);
    }

    @Test
    void rejectionForcesOutOfServiceAndKeepsTheReason() {
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(), Set.of());
        tecnico.aprobarValidacion();
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);

        tecnico.rechazarValidacion("Documentos vencidos");

        assertThat(tecnico.getEstadoValidacion()).isEqualTo(EstadoValidacion.RECHAZADO);
        assertThat(tecnico.getMotivoRechazoValidacion()).isEqualTo("Documentos vencidos");
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.FUERA_DE_SERVICIO);
        assertThatThrownBy(() -> tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE))
                .isInstanceOf(TecnicoNoValidadoException.class);
    }

    @Test
    void occupiedTechnicianCannotChangeState() {
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(), Set.of());
        tecnico.aprobarValidacion();
        tecnico.cambiarEstado(EstadoOperativo.OCUPADO);

        assertThatThrownBy(() -> tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE))
                .isInstanceOf(TecnicoAsignadoException.class);
    }

    @Test
    void managesCertificationsThroughAggregateBehavior() {
        Certificacion certification = new Certificacion("Tecnico", "SENA", LocalDate.of(2027, 1, 31));
        Tecnico tecnico = Tecnico.crear(7L, "123", null, Set.of(), Set.of());

        tecnico.agregarCertificacion(certification);
        tecnico.eliminarCertificacion(certification);

        assertThat(tecnico.getCertificaciones()).isEmpty();
    }
}
