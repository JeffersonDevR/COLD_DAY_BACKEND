package com.sena.cold_day.modules.tecnicos.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.infrastructure.repository.TecnicoRepositoryAdapter;

@DataJpaTest
@Import(TecnicoRepositoryAdapter.class)
class TecnicosRepositoryTest {

    @Autowired TecnicoRepositoryAdapter repository;

    @BeforeEach
    void cleanup() {
        repository.deleteAll();
    }

    private Tecnico tecnico(String numeroIdentificacion, String nombres, boolean activo) {
        Tecnico tecnico = new Tecnico();
        tecnico.setNumeroIdentificacion(numeroIdentificacion);
        tecnico.setNombres(nombres);
        tecnico.setApellidos("Garcia");
        tecnico.setEmail("ana@example.com");
        tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
        tecnico.setCategoriasServicio(Set.of(CategoriaServicio.REFRIGERACION));
        tecnico.setCertificaciones(Set.of(new Certificacion("Tecnico", "SENA", LocalDate.of(2027, 1, 31))));
        tecnico.setActivo(activo);
        return tecnico;
    }

    @Test
    void rejectsDuplicateNumeroIdentificacion() {
        repository.save(tecnico("123", "Ana", true));
        assertThatThrownBy(() -> repository.save(tecnico("123", "Luis", true)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findMethodsExcludeSoftDeletedRows() {
        repository.save(tecnico("100", "Ana", true));
        Tecnico deleted = repository.save(tecnico("200", "Luis", false));
        assertThat(repository.findByActivoTrue()).extracting(Tecnico::getNumeroIdentificacion).containsExactly("100");
        assertThat(repository.findByIdAndActivoTrue(deleted.getId())).isEmpty();
    }

    @Test
    void retainsSoftDeletedRow() {
        Tecnico deleted = repository.save(tecnico("300", "Marta", false));
        assertThat(repository.findByIdAndActivoTrue(deleted.getId())).isEmpty();
    }
}
