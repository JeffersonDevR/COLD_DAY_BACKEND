package com.sena.cold_day.modules.tecnicos.infrastructure.persistence;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.r2dbc.DataR2dbcTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.context.annotation.Import;
import com.sena.cold_day.modules.tecnicos.infrastructure.adapters.R2dbcConfig;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;

import reactor.test.StepVerifier;

@DataR2dbcTest
@Import(R2dbcConfig.class)
class TecnicosRepositoryTest {

	@Autowired
	TecnicoRepository repository;

	@Autowired
	DatabaseClient databaseClient;

	@AfterEach
	void cleanup() {
		repository.deleteAll().block();
	}

	private Tecnico tecnico(String numeroIdentificacion, String nombres, boolean activo) {
		Tecnico tecnico = new Tecnico();
		tecnico.setNumeroIdentificacion(numeroIdentificacion);
		tecnico.setNombres(nombres);
		tecnico.setApellidos("Garcia");
		tecnico.setEmail("ana@example.com");
		tecnico.setEstadoOperativo(EstadoOperativo.DISPONIBLE);
		tecnico.setCategoriasServicio(Set.of(CategoriaServicio.REFRIGERACION));
		tecnico.setCertificaciones(
				Set.of(new Certificacion("Tecnico en refrigeracion", "SENA", LocalDate.of(2027, 1, 31))));
		tecnico.setActivo(activo);
		return tecnico;
	}

	@Test
	void rejectsDuplicateNumeroIdentificacion() {
		repository.save(tecnico("123", "Ana", true)).block();

		StepVerifier.create(repository.save(tecnico("123", "Luis", true)))
				.expectError(DataIntegrityViolationException.class)
				.verify();
	}

	@Test
	void findAllAndFindByIdExcludeSoftDeletedRows() {
		repository.save(tecnico("100", "Ana", true)).block();
		Tecnico deleted = repository.save(tecnico("200", "Luis", false)).block();

		StepVerifier.create(repository.findByActivoTrue().filter(t -> t.getNumeroIdentificacion().equals("100")))
				.expectNextCount(1)
				.verifyComplete();

		StepVerifier.create(repository.findByIdAndActivoTrue(deleted.getId()))
				.verifyComplete();
	}

	@Test
	void retainsSoftDeletedRow() {
		Tecnico deleted = repository.save(tecnico("300", "Marta", false)).block();

		StepVerifier.create(databaseClient.sql("SELECT COUNT(*) FROM tecnico WHERE id = :id AND activo = false")
				.bind("id", deleted.getId())
				.map(row -> row.get(0, Long.class))
				.one())
				.expectNext(1L)
				.verifyComplete();
	}
}
