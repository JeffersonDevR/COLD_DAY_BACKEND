package com.sena.cold_day.tecnicos.internal.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.sena.cold_day.tecnicos.internal.domain.CategoriaServicio;
import com.sena.cold_day.tecnicos.internal.domain.Certificacion;
import com.sena.cold_day.tecnicos.internal.domain.EstadoOperativo;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;
import com.sena.cold_day.tecnicos.internal.domain.TecnicoRepository;

@DataJpaTest
@Import(JpaTecnicoRepository.class)
class TecnicosRepositoryTest {

	@Autowired
	TecnicoRepository repository;

	@Autowired
	JdbcTemplate jdbcTemplate;

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
		repository.saveAndFlush(tecnico("123", "Ana", true));

		assertThatThrownBy(() -> repository.saveAndFlush(tecnico("123", "Luis", true)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void findAllAndFindByIdExcludeSoftDeletedRows() {
		Tecnico active = repository.saveAndFlush(tecnico("100", "Ana", true));
		repository.saveAndFlush(tecnico("200", "Luis", false));

		assertThat(repository.findAll()).containsExactly(active);
		assertThat(repository.findById(200L)).isEmpty();
	}

	@Test
	void retainsSoftDeletedRow() {
		Tecnico deleted = repository.saveAndFlush(tecnico("300", "Marta", false));

		Integer rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tecnico WHERE id = ? AND activo = false",
				Integer.class, deleted.getId());
		assertThat(rows).isEqualTo(1);
	}
}
