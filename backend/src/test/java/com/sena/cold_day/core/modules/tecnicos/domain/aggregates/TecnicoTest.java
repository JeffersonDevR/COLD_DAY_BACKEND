package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

class TecnicoTest {

    @Test
    void startsAvailableAndOwnsItsCollections() {
        Set<CategoriaServicio> categories = Set.of(CategoriaServicio.REFRIGERACION);
        Tecnico tecnico = Tecnico.crear("123", "Ana", "Garcia", null, null, null, categories, Set.of());

        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
        assertThat(tecnico.getCategoriasServicio()).containsExactly(CategoriaServicio.REFRIGERACION);
        assertThatThrownBy(() -> tecnico.getCategoriasServicio().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void occupiedTechnicianCannotChangeState() {
        Tecnico tecnico = Tecnico.crear("123", "Ana", "Garcia", null, null, null, Set.of(), Set.of());
        tecnico.cambiarEstado(EstadoOperativo.OCUPADO);

        assertThatThrownBy(() -> tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE))
                .isInstanceOf(TecnicoAsignadoException.class);
    }

    @Test
    void managesCertificationsThroughAggregateBehavior() {
        Certificacion certification = new Certificacion("Tecnico", "SENA", LocalDate.of(2027, 1, 31));
        Tecnico tecnico = Tecnico.crear("123", "Ana", "Garcia", null, null, null, Set.of(), Set.of());

        tecnico.agregarCertificacion(certification);
        tecnico.eliminarCertificacion(certification);

        assertThat(tecnico.getCertificaciones()).isEmpty();
    }
}
