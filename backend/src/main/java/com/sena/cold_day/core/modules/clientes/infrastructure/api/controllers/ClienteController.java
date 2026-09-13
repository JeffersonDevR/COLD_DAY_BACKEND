package com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.application.usecases.RegistrarClienteUseCase;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.requests.ClienteApiRequest;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.responses.ClienteApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final RegistrarClienteUseCase registrar;

    public ClienteController(RegistrarClienteUseCase registrar) {
        this.registrar = registrar;
    }

    /**
     * Creates the client profile for the authenticated principal (carried
     * decision D6). The {@code usuarioId} is never read from the body.
     */
    @PostMapping
    public ResponseEntity<ClienteApiResponse> crear(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody ClienteApiRequest request) {
        ClienteResponse created = registrar.registrar(toApplicationRequest(request), principal.usuarioId());
        return ResponseEntity.created(URI.create("/api/clientes/" + created.id().valor()))
                .body(ClienteApiResponse.from(created));
    }

    private ClienteRequest toApplicationRequest(ClienteApiRequest request) {
        return new ClienteRequest(request.tipoCliente(), request.calle(), request.ciudad(),
                request.barrio(), request.ubicacion());
    }
}
