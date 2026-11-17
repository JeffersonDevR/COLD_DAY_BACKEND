package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilRequest;
import com.sena.cold_day.core.modules.usuarios.application.usecases.CrearSolicitudPerfilUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.ListarSolicitudesPerfilUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.ResolverSolicitudPerfilUseCase;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.ResolverSolicitudPerfilApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.SolicitudPerfilApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses.SolicitudPerfilApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * Flujo PQRS de cambio de perfil: el solicitante autenticado crea la solicitud
 * y un ADMINISTRADOR consulta la bandeja y la resuelve. La identidad del
 * solicitante sale siempre del principal, nunca del body.
 */
@RestController
public class SolicitudPerfilController {

    private final CrearSolicitudPerfilUseCase crear;
    private final ListarSolicitudesPerfilUseCase listar;
    private final ResolverSolicitudPerfilUseCase resolver;

    public SolicitudPerfilController(CrearSolicitudPerfilUseCase crear,
            ListarSolicitudesPerfilUseCase listar, ResolverSolicitudPerfilUseCase resolver) {
        this.crear = crear;
        this.listar = listar;
        this.resolver = resolver;
    }

    @PostMapping("/api/solicitudes-perfil")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SolicitudPerfilApiResponse> crear(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody SolicitudPerfilApiRequest request) {
        var response = crear.crear(principal.usuarioId(),
                new SolicitudPerfilRequest(request.perfilDeseado(), request.motivacion()));
        return ResponseEntity.created(URI.create("/api/solicitudes-perfil/" + response.id()))
                .body(SolicitudPerfilApiResponse.from(response));
    }

    /** Bandeja admin, paginada por {@code pagina}/{@code tamano} (BE-P1). */
    @GetMapping("/api/admin/solicitudes-perfil")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<SolicitudPerfilApiResponse> listar(
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        return listar.listar(pagina, tamano).stream().map(SolicitudPerfilApiResponse::from).toList();
    }

    @PatchMapping("/api/admin/solicitudes-perfil/{id}/resolver")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public SolicitudPerfilApiResponse resolver(@PathVariable Long id,
            @Valid @RequestBody ResolverSolicitudPerfilApiRequest request) {
        return SolicitudPerfilApiResponse.from(
                resolver.resolver(id, Boolean.TRUE.equals(request.aprobar()), request.motivoRechazo()));
    }
}
