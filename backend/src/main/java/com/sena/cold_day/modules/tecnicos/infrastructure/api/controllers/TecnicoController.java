package com.sena.cold_day.modules.tecnicos.infrastructure.api.controllers;

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

import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.modules.tecnicos.application.usecases.ActualizarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.BuscarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.EliminarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.application.usecases.RegistrarTecnicoUseCase;
import com.sena.cold_day.modules.tecnicos.infrastructure.api.requests.TecnicoApiRequest;
import com.sena.cold_day.modules.tecnicos.infrastructure.api.responses.TecnicoApiResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

    private final RegistrarTecnicoUseCase registrar;
    private final ActualizarTecnicoUseCase actualizar;
    private final BuscarTecnicoUseCase buscar;
    private final EliminarTecnicoUseCase eliminar;
    private final TecnicoMapper mapper;

    public TecnicoController(RegistrarTecnicoUseCase registrar, ActualizarTecnicoUseCase actualizar,
            BuscarTecnicoUseCase buscar, EliminarTecnicoUseCase eliminar, TecnicoMapper mapper) {
        this.registrar = registrar;
        this.actualizar = actualizar;
        this.buscar = buscar;
        this.eliminar = eliminar;
        this.mapper = mapper;
    }

    @PostMapping
    public ResponseEntity<TecnicoApiResponse> crear(@Valid @RequestBody TecnicoApiRequest request) {
        TecnicoApiResponse created = TecnicoApiResponse.from(mapper.toResponse(registrar.registrar(toApplicationRequest(request))));
        return ResponseEntity.created(URI.create("/api/tecnicos/" + created.id())).body(created);
    }

    @GetMapping
    public List<TecnicoApiResponse> listar() {
        return buscar.listar().stream().map(mapper::toResponse).map(TecnicoApiResponse::from).toList();
    }

    @GetMapping("/{id}")
    public TecnicoApiResponse obtener(@PathVariable Long id) {
        return TecnicoApiResponse.from(mapper.toResponse(buscar.obtener(id)));
    }

    @PutMapping("/{id}")
    public TecnicoApiResponse actualizar(@PathVariable Long id, @Valid @RequestBody TecnicoApiRequest request) {
        return TecnicoApiResponse.from(mapper.toResponse(actualizar.actualizar(id, toApplicationRequest(request))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        eliminar.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    private TecnicoRequest toApplicationRequest(TecnicoApiRequest request) {
        return new TecnicoRequest(request.numeroIdentificacion(), request.nombres(), request.apellidos(),
                request.telefono(), request.email(), request.fotoUrl(), request.categoriasServicio(),
                request.certificaciones());
    }
}
