package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.proveedores.application.usecases.AceptarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.EntregarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ListarSolicitudesProveedorUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.RechazarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses.OfertaInsumoApiResponse;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses.SolicitudInsumoApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Supplier-side insumo dispatch surface (design "API Contracts"). The acting
 * supplier polls its pending offers and accepts, rejects or confirms delivery;
 * every action resolves the supplier from the authenticated principal, never
 * from the body, and only the supplier that actually holds the offer may act on
 * it (spec disp.R3/R5/R7, design AD7/AD8).
 *
 * <p>Authorization is enforced server-side with {@code @PreAuthorize}; no
 * {@code permitAll} matcher is added, so an unauthenticated caller is rejected
 * with 401 and a non-supplier with 403.
 */
@RestController
@RequestMapping("/api")
public class InsumoController {

    private final ListarSolicitudesProveedorUseCase listar;
    private final AceptarInsumoUseCase aceptar;
    private final RechazarInsumoUseCase rechazar;
    private final EntregarInsumoUseCase entregar;

    public InsumoController(ListarSolicitudesProveedorUseCase listar, AceptarInsumoUseCase aceptar,
            RechazarInsumoUseCase rechazar, EntregarInsumoUseCase entregar) {
        this.listar = listar;
        this.aceptar = aceptar;
        this.rechazar = rechazar;
        this.entregar = entregar;
    }

    /** The authenticated supplier's pending, still-vigente offers (spec disp.R3). */
    @GetMapping("/proveedores/me/solicitudes")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public List<OfertaInsumoApiResponse> misSolicitudes(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listar.listar(principal.usuarioId()).stream()
                .map(solicitud -> OfertaInsumoApiResponse.from(solicitud.oferta(), solicitud.requerimiento()))
                .toList();
    }

    /** Atomic first-to-accept (spec disp.R3): one winner, every loser gets 409. */
    @PostMapping("/insumos/{ofertaId}/aceptar")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public SolicitudInsumoApiResponse aceptar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OfertaInsumoId ofertaId) {
        return SolicitudInsumoApiResponse.from(aceptar.aceptar(principal.usuarioId(), ofertaId));
    }

    /** Explicit decline (spec disp.R5): records {@code RECHAZADO} without binding. */
    @PostMapping("/insumos/{ofertaId}/rechazar")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public OfertaInsumoApiResponse rechazar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OfertaInsumoId ofertaId) {
        return OfertaInsumoApiResponse.from(rechazar.rechazar(principal.usuarioId(), ofertaId), null);
    }

    /** Delivery confirmation by the winning supplier (spec disp.R7, design AD8). */
    @PostMapping("/insumos/{id}/entregar")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public SolicitudInsumoApiResponse entregar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable RequerimientoInsumoId id) {
        return SolicitudInsumoApiResponse.from(entregar.entregar(principal.usuarioId(), id));
    }
}
