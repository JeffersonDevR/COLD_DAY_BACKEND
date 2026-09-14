package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.ot.application.usecases.AceptarOfertaUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.ListarOfertasTecnicoUseCase;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OfertaOtApiResponse;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Dispatch-offer surface owned by PR6b: a technician accepts a pending offer
 * (RF-F1-09) and polls its own vigente offers. Both actions resolve the
 * technician from the authenticated principal, never from the body.
 */
@RequestMapping("/api")
@RestController
public class OfertaOtController {

    private final AceptarOfertaUseCase aceptar;
    private final ListarOfertasTecnicoUseCase listar;

    public OfertaOtController(AceptarOfertaUseCase aceptar, ListarOfertasTecnicoUseCase listar) {
        this.aceptar = aceptar;
        this.listar = listar;
    }

    /** Atomic acceptance: exactly one simultaneous accept wins; the rest get a 409. */
    @PostMapping("/ofertas/{id}/aceptar")
    @PreAuthorize("hasRole('TECNICO')")
    public OtApiResponse aceptar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OfertaOtId id) {
        return OtApiResponse.from(aceptar.aceptar(principal.usuarioId(), id));
    }

    /** The authenticated technician's pending, still-vigente offers (RF-F1-09). */
    @GetMapping("/tecnicos/me/ofertas")
    @PreAuthorize("hasRole('TECNICO')")
    public List<OfertaOtApiResponse> misOfertas(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listar.listar(principal.usuarioId()).stream().map(OfertaOtApiResponse::from).toList();
    }
}
