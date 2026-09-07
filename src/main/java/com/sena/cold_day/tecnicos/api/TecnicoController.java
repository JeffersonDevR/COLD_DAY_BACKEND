package com.sena.cold_day.tecnicos.api;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.tecnicos.application.ActualizarTecnicoUseCase;
import com.sena.cold_day.tecnicos.application.BuscarTecnicoUseCase;
import com.sena.cold_day.tecnicos.application.EliminarTecnicoUseCase;
import com.sena.cold_day.tecnicos.application.RegistrarTecnicoUseCase;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;

import jakarta.validation.Valid;

/**
 * REST API of the Técnicos module under /api/tecnicos. Thin: delegates to
 * application use cases and maps entities with TecnicoResponse.from.
 */
@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

	private final RegistrarTecnicoUseCase registrar;
	private final ActualizarTecnicoUseCase actualizar;
	private final BuscarTecnicoUseCase buscar;
	private final EliminarTecnicoUseCase eliminar;

	public TecnicoController(RegistrarTecnicoUseCase registrar, ActualizarTecnicoUseCase actualizar,
			BuscarTecnicoUseCase buscar, EliminarTecnicoUseCase eliminar) {
		this.registrar = registrar;
		this.actualizar = actualizar;
		this.buscar = buscar;
		this.eliminar = eliminar;
	}

	@PostMapping
	public ResponseEntity<TecnicoResponse> crear(@Valid @RequestBody TecnicoRequest request) {
		TecnicoResponse created = TecnicoResponse.from(registrar.registrar(request));
		return ResponseEntity.created(URI.create("/api/tecnicos/" + created.id())).body(created);
	}

	@GetMapping
	public List<TecnicoResponse> listar() {
		return buscar.listar().stream().map(TecnicoResponse::from).toList();
	}

	@GetMapping("/{id}")
	public TecnicoResponse obtener(@PathVariable Long id) {
		return TecnicoResponse.from(buscar.obtener(id));
	}

	@PutMapping("/{id}")
	public TecnicoResponse actualizar(@PathVariable Long id, @Valid @RequestBody TecnicoRequest request) {
		return TecnicoResponse.from(actualizar.actualizar(id, request));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> eliminar(@PathVariable Long id) {
		eliminar.eliminar(id);
		return ResponseEntity.noContent().build();
	}
}
