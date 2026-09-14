package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.administracion.application.usecases.CargarComprobanteUseCase;
import com.sena.cold_day.core.modules.administracion.application.usecases.RegistrarPagoUseCase;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.requests.ComprobanteApiRequest;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.requests.RegistrarPagoApiRequest;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.LiquidacionApiResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * Superficie del tecnico para el control de recaudo (CU-12 / RF-F1-23/24/26):
 * registra el cobro al cierre y carga el comprobante de consignacion.
 */
@RestController
@RequestMapping("/api/liquidaciones")
public class LiquidacionController {

    private final RegistrarPagoUseCase registrarPago;
    private final CargarComprobanteUseCase cargarComprobante;

    public LiquidacionController(RegistrarPagoUseCase registrarPago,
            CargarComprobanteUseCase cargarComprobante) {
        this.registrarPago = registrarPago;
        this.cargarComprobante = cargarComprobante;
    }

    /** RF-F1-26: el tecnico asignado registra monto y medio cobrados al cierre. */
    @PostMapping("/ot/{otId}")
    @PreAuthorize("hasRole('TECNICO')")
    public LiquidacionApiResponse registrar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId otId, @Valid @RequestBody RegistrarPagoApiRequest request) {
        return LiquidacionApiResponse.from(registrarPago.registrar(principal.usuarioId(), otId,
                request.montoCobrado(), request.medioPago()));
    }

    /** RF-F1-24: el tecnico carga la foto del comprobante para verificacion. */
    @PostMapping("/{id}/comprobante")
    @PreAuthorize("hasRole('TECNICO')")
    public LiquidacionApiResponse cargarComprobante(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable LiquidacionId id, @Valid @RequestBody ComprobanteApiRequest request) {
        return LiquidacionApiResponse.from(
                cargarComprobante.cargar(principal.usuarioId(), id, request.comprobanteUrl()));
    }
}
