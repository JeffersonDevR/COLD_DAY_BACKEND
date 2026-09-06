package com.sena.cold_day.tecnicos.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.tecnicos.api.TecnicoRequest;

@ExtendWith(MockitoExtension.class)
class TecnicosServiceTest {

	@Mock
	TecnicoRepository repository;

	@Mock
	ApplicationEventPublisher events;

	@InjectMocks
	TecnicosService service;

	private TecnicoRequest request(String numeroIdentificacion) {
		return new TecnicoRequest(numeroIdentificacion, "Ana", "Garcia", "3001234567", "ana@example.com", null,
				Set.of(CategoriaServicio.REFRIGERACION),
				Set.of(new Certificacion("Tecnico en refrigeracion", "SENA", LocalDate.of(2027, 1, 31))));
	}

	@Test
	void crearAppliesDefaultsAndFields() {
		when(repository.saveAndFlush(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Tecnico saved = service.crear(request("123"));

		assertThat(saved.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
		assertThat(saved.isActivo()).isTrue();
		assertThat(saved.getNumeroIdentificacion()).isEqualTo("123");
		assertThat(saved.getNombres()).isEqualTo("Ana");
		assertThat(saved.getApellidos()).isEqualTo("Garcia");
		assertThat(saved.getCategoriasServicio()).containsExactly(CategoriaServicio.REFRIGERACION);
		assertThat(saved.getCertificaciones()).hasSize(1);
	}

	@Test
	void crearTranslatesDuplicateConstraint() {
		when(repository.saveAndFlush(any(Tecnico.class)))
				.thenThrow(new DataIntegrityViolationException("unique constraint"));

		assertThatThrownBy(() -> service.crear(request("123")))
				.isInstanceOf(NumeroIdentificacionDuplicadoException.class);
	}

	@Test
	void listarReturnsActiveTecnicos() {
		Tecnico tecnico = new Tecnico();
		tecnico.setNumeroIdentificacion("123");
		when(repository.findAll()).thenReturn(List.of(tecnico));

		assertThat(service.listar()).containsExactly(tecnico);
	}

	@Test
	void obtenerUnknownIdThrows() {
		when(repository.findById(999L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.obtener(999L)).isInstanceOf(TecnicoNoEncontradoException.class);
	}

	@Test
	void actualizarReplacesMutableFieldsOnly() {
		Tecnico existing = new Tecnico();
		existing.setNumeroIdentificacion("123");
		existing.setNombres("Ana");
		existing.setEstadoOperativo(EstadoOperativo.OCUPADO);
		when(repository.findById(5L)).thenReturn(Optional.of(existing));
		when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Tecnico updated = service.actualizar(5L, request("456"));

		assertThat(updated.getNumeroIdentificacion()).isEqualTo("456");
		assertThat(updated.getNombres()).isEqualTo("Ana");
		assertThat(updated.getEstadoOperativo()).isEqualTo(EstadoOperativo.OCUPADO);
		assertThat(updated.isActivo()).isTrue();
		verify(repository).save(existing);
	}

	@Test
	void eliminarSetsActivoFalse() {
		Tecnico existing = new Tecnico();
		existing.setNumeroIdentificacion("123");
		when(repository.findById(5L)).thenReturn(Optional.of(existing));

		service.eliminar(5L);

		assertThat(existing.isActivo()).isFalse();
		verify(repository).saveAndFlush(existing);
	}
}
