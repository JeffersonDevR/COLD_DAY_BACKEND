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

import com.sena.cold_day.tecnicos.domain.Tecnico;
import com.sena.cold_day.tecnicos.domain.TecnicosService;

import jakarta.validation.Valid;

/**
 * REST API of the Técnicos module under /api/tecnicos. Thin: delegates to
 * TecnicosService and maps entities with TecnicoResponse.from.
 */
@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

	private final TecnicosService service;

	public TecnicoController(TecnicosService service) {
		this.service = service;
	}

	@PostMapping
	public ResponseEntity<TecnicoResponse> crear(@Valid @RequestBody TecnicoRequest request) {
		TecnicoResponse created = TecnicoResponse.from(service.crear(request));
		return ResponseEntity.created(URI.create("/api/tecnicos/" + created.id())).body(created);
	}

	@GetMapping
	public List<TecnicoResponse> listar() {
		return service.listar().stream().map(TecnicoResponse::from).toList();
	}

	@GetMapping("/{id}")
	public TecnicoResponse obtener(@PathVariable Long id) {
		return TecnicoResponse.from(service.obtener(id));
	}

	@PutMapping("/{id}")
	public TecnicoResponse actualizar(@PathVariable Long id, @Valid @RequestBody TecnicoRequest request) {
		return TecnicoResponse.from(service.actualizar(id, request));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> eliminar(@PathVariable Long id) {
		service.eliminar(id);
		return ResponseEntity.noContent().build();
	}
}
