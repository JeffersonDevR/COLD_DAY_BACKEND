package com.sena.cold_day.api.tecnicos.controllers;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.modules.tecnicos.application.usecases.ActualizarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.BuscarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.EliminarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.RegistrarTecnicoUseCase;
import com.sena.cold_day.api.tecnicos.requests.TecnicoRequest;
import com.sena.cold_day.api.tecnicos.responses.TecnicoResponse;

import jakarta.validation.Valid;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

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
	public Mono<ResponseEntity<TecnicoResponse>> crear(@Valid @RequestBody TecnicoRequest request) {
		return registrar.registrar(request)
				.map(TecnicoResponse::from)
				.map(created -> ResponseEntity.created(URI.create("/api/tecnicos/" + created.id())).body(created));
	}

	@GetMapping
	public Flux<TecnicoResponse> listar() {
		return buscar.listar().map(TecnicoResponse::from);
	}

	@GetMapping("/{id}")
	public Mono<TecnicoResponse> obtener(@PathVariable Long id) {
		return buscar.obtener(id).map(TecnicoResponse::from);
	}

	@PutMapping("/{id}")
	public Mono<TecnicoResponse> actualizar(@PathVariable Long id, @Valid @RequestBody TecnicoRequest request) {
		return actualizar.actualizar(id, request).map(TecnicoResponse::from);
	}

	@DeleteMapping("/{id}")
	public Mono<ResponseEntity<Void>> eliminar(@PathVariable Long id) {
		return eliminar.eliminar(id).then(Mono.just(ResponseEntity.noContent().build()));
	}
}
