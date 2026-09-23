package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ListarProveedoresUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.RegistrarProveedorUseCase;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests.ProveedorApiRequest;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses.ProveedorApiResponse;

import jakarta.validation.Valid;

/**
 * Admin-only supplier surface. Authorization is enforced server-side with
 * {@code @PreAuthorize}; no {@code permitAll} matcher is added for this path, so
 * an unauthenticated caller is rejected with 401 and a non-admin with 403 (D7).
 * There is no public supplier registration surface.
 */
@RestController
@RequestMapping("/api/proveedores")
public class ProveedorController {

    private final RegistrarProveedorUseCase registrar;
    private final ListarProveedoresUseCase listarProveedores;

    public ProveedorController(RegistrarProveedorUseCase registrar, ListarProveedoresUseCase listarProveedores) {
        this.registrar = registrar;
        this.listarProveedores = listarProveedores;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ResponseEntity<ProveedorApiResponse> crear(@Valid @RequestBody ProveedorApiRequest request) {
        ProveedorResponse created = registrar.registrar(request.toApplicationRequest());
        return ResponseEntity.created(URI.create("/api/proveedores/" + created.id()))
                .body(ProveedorApiResponse.from(created));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<ProveedorApiResponse> listar() {
        return listarProveedores.listar().stream().map(ProveedorApiResponse::from).toList();
    }
}
