package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.usuarios.application.usecases.GestionarCuentasInternasUseCase;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.CuentaInternaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.EstadoCuentaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses.CuentaApiResponse;

import jakarta.validation.Valid;

/** Cuentas del panel (contable, Recursos Humanos). */
@RestController
@RequestMapping("/api/admin/cuentas")
public class CuentasController {

    private final GestionarCuentasInternasUseCase cuentas;

    public CuentasController(GestionarCuentasInternasUseCase cuentas) {
        this.cuentas = cuentas;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('GESTIONAR_CUENTAS')")
    public List<CuentaApiResponse> listar() {
        return cuentas.listar().stream().map(CuentaApiResponse::from).toList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('GESTIONAR_CUENTAS')")
    public ResponseEntity<CuentaApiResponse> crear(@Valid @RequestBody CuentaInternaApiRequest request) {
        CuentaApiResponse creada = CuentaApiResponse.from(
                cuentas.crear(request.nombre(), request.correo(), request.rol()));
        return ResponseEntity.created(URI.create("/api/admin/cuentas/" + creada.id())).body(creada);
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('GESTIONAR_CUENTAS')")
    public ResponseEntity<Void> cambiarEstado(@PathVariable Long id,
            @Valid @RequestBody EstadoCuentaApiRequest request) {
        cuentas.cambiarEstado(new UsuarioId(id), request.activa());
        return ResponseEntity.noContent().build();
    }
}
