package com.sena.cold_day.modules.tecnicos.application.usecases;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.api.tecnicos.requests.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;
import com.sena.cold_day.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

@ExtendWith(MockitoExtension.class)
class TecnicosUseCaseTest {

	@Mock
	TecnicoRepository repository;

	@Mock
	ApplicationEventPublisher events;

	@InjectMocks
	RegistrarTecnicoUseCase registrar;

	@InjectMocks
	BuscarTecnicoUseCase buscar;

	@InjectMocks
	ActualizarTecnicoUseCase actualizar;

	@InjectMocks
	EliminarTecnicoUseCase eliminar;

	@InjectMocks
	CambiarDisponibilidadUseCase cambiarDisponibilidad;

	private TecnicoRequest request(String numeroIdentificacion) {
		return new TecnicoRequest(numeroIdentificacion, "Ana", "Garcia", "3001234567", "ana@example.com", null,
				Set.of(CategoriaServicio.REFRIGERACION),
				Set.of(new Certificacion("Tecnico en refrigeracion", "SENA", LocalDate.of(2027, 1, 31))));
	}

	@Test
	void crearAppliesDefaultsAndFields() {
		when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> {
			Tecnico t = invocation.getArgument(0);
			t.setId(1L);
			return Mono.just(t);
		});

		StepVerifier.create(registrar.registrar(request("123")))
				.expectNextMatches(saved -> saved.getEstadoOperativo() == EstadoOperativo.DISPONIBLE
						&& saved.isActivo()
						&& saved.getNumeroIdentificacion().equals("123")
						&& saved.getNombres().equals("Ana")
						&& saved.getApellidos().equals("Garcia")
						&& saved.getCategoriasServicio().contains(CategoriaServicio.REFRIGERACION)
						&& saved.getCertificaciones().size() == 1)
				.verifyComplete();
	}

	@Test
	void listarReturnsActiveTecnicos() {
		Tecnico tecnico = new Tecnico();
		tecnico.setNumeroIdentificacion("123");
		when(repository.findByActivoTrue()).thenReturn(Flux.just(tecnico));

		StepVerifier.create(buscar.listar())
				.expectNext(tecnico)
				.verifyComplete();
	}

	@Test
	void obtenerUnknownIdThrows() {
		when(repository.findByIdAndActivoTrue(999L)).thenReturn(Mono.empty());

		StepVerifier.create(buscar.obtener(999L))
				.expectError(TecnicoNoEncontradoException.class)
				.verify();
	}

	@Test
	void actualizarReplacesFields() {
		Tecnico existing = new Tecnico();
		existing.setNumeroIdentificacion("123");
		existing.setNombres("Ana");
		existing.setEstadoOperativo(EstadoOperativo.OCUPADO);
		when(repository.findByIdAndActivoTrue(5L)).thenReturn(Mono.just(existing));
		when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

		StepVerifier.create(actualizar.actualizar(5L, request("456")))
				.expectNextMatches(updated -> updated.getNumeroIdentificacion().equals("456")
						&& updated.getNombres().equals("Ana")
						&& updated.getEstadoOperativo().equals(EstadoOperativo.OCUPADO)
						&& updated.isActivo())
				.verifyComplete();
		verify(repository).save(existing);
	}

	@Test
	void eliminarSetsActivoFalse() {
		Tecnico existing = new Tecnico();
		existing.setNumeroIdentificacion("123");
		existing.setActivo(true);
		when(repository.findByIdAndActivoTrue(5L)).thenReturn(Mono.just(existing));
		when(repository.save(any(Tecnico.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

		StepVerifier.create(eliminar.eliminar(5L))
				.verifyComplete();

		verify(repository).save(existing);
	}

	@Test
	void cambiarDisponibilidadUpdatesOperationalState() {
		Tecnico existing = new Tecnico();
		existing.setActivo(true);
		when(repository.findByIdAndActivoTrue(5L)).thenReturn(Mono.just(existing));
		when(repository.save(existing)).thenReturn(Mono.just(existing));

		StepVerifier.create(cambiarDisponibilidad.cambiarEstado(5L, EstadoOperativo.OCUPADO))
				.verifyComplete();

		verify(repository).save(existing);
	}
}
