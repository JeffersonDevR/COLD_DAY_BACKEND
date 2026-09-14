package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.administracion.application.usecases.GestionarDisputaUseCase;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.requests.AbrirDisputaApiRequest;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.DisputaApiResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * Superficie del cliente para la mediacion (RF-F1-25): abre la disputa al
 * rechazar el diagnostico o el trabajo entregado. La resolucion es exclusiva
 * del administrador ({@code AdminController}).
 */
@RestController
@RequestMapping("/api/disputas")
public class DisputaController {

    private final GestionarDisputaUseCase gestionar;

    public DisputaController(GestionarDisputaUseCase gestionar) {
        this.gestionar = gestionar;
    }

    @PostMapping("/ot/{otId}")
    @PreAuthorize("hasRole('CLIENTE')")
    public DisputaApiResponse abrir(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId otId, @Valid @RequestBody AbrirDisputaApiRequest request) {
        return DisputaApiResponse.from(
                gestionar.abrir(principal.usuarioId(), otId, request.motivo()));
    }
}
