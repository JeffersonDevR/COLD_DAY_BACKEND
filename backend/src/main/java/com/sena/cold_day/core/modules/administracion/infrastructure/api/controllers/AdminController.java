package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.administracion.application.usecases.ConsultarMetricasAdminUseCase;
import com.sena.cold_day.core.modules.administracion.application.usecases.GestionarDisputaUseCase;
import com.sena.cold_day.core.modules.administracion.application.usecases.VerificarComprobanteUseCase;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.requests.RechazoLiquidacionApiRequest;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.requests.ResolverDisputaApiRequest;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.DisputaApiResponse;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.LiquidacionApiResponse;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.MetricasAdminApiResponse;
import com.sena.cold_day.core.modules.ot.application.usecases.ListarOtUseCase;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;

import jakarta.validation.Valid;

/**
 * Modulo de administracion (CU-13, CU-15 / RF-F1-22/24/25): tablero de
 * monitoreo, conciliacion de consignaciones en efectivo y bandeja de disputas.
 * Este controller exige rol {@code ADMINISTRADOR} en todos sus endpoints.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMINISTRADOR')")
public class AdminController {

    private final ConsultarMetricasAdminUseCase metricas;
    private final VerificarComprobanteUseCase comprobantes;
    private final GestionarDisputaUseCase disputas;
    private final ListarOtUseCase listarOts;

    public AdminController(ConsultarMetricasAdminUseCase metricas,
            VerificarComprobanteUseCase comprobantes, GestionarDisputaUseCase disputas,
            ListarOtUseCase listarOts) {
        this.metricas = metricas;
        this.comprobantes = comprobantes;
        this.disputas = disputas;
        this.listarOts = listarOts;
    }

    /** CU-15 / RF-F1-22: tablero con servicios, tecnicos, tiempos e incidencias. */
    @GetMapping("/metricas")
    public MetricasAdminApiResponse metricas() {
        return MetricasAdminApiResponse.from(metricas.consultar());
    }

    /** RF-F1-25: listado global de OTs para el monitoreo administrativo. */
    @GetMapping("/ot")
    public List<OtApiResponse> ots() {
        return listarOts.listarTodas().stream()
                .map(resumen -> OtApiResponse.from(resumen.ot(), resumen.clienteNombre(), resumen.tecnicoNombre()))
                .toList();
    }

    /** CU-13: bandeja de comprobantes pendientes de verificacion. */
    @GetMapping("/liquidaciones/pendientes")
    public List<LiquidacionApiResponse> liquidacionesPendientes() {
        return comprobantes.listarPendientes().stream().map(LiquidacionApiResponse::from).toList();
    }

    /** Historial completo de liquidaciones para conciliacion de comisiones. */
    @GetMapping("/liquidaciones")
    public List<LiquidacionApiResponse> liquidaciones() {
        return comprobantes.listarTodas().stream().map(LiquidacionApiResponse::from).toList();
    }

    /** CU-13: aprueba el comprobante y desbloquea al tecnico de inmediato. */
    @PostMapping("/liquidaciones/{id}/aprobar")
    public LiquidacionApiResponse aprobar(@PathVariable LiquidacionId id) {
        return LiquidacionApiResponse.from(comprobantes.aprobar(id));
    }

    /** CU-13 (2a): rechaza el soporte con motivo; el tecnico sigue bloqueado. */
    @PostMapping("/liquidaciones/{id}/rechazar")
    public LiquidacionApiResponse rechazar(@PathVariable LiquidacionId id,
            @Valid @RequestBody RechazoLiquidacionApiRequest request) {
        return LiquidacionApiResponse.from(comprobantes.rechazar(id, request.motivo()));
    }

    /** RF-F1-25: bandeja de disputas abiertas para mediacion. */
    @GetMapping("/disputas/abiertas")
    public List<DisputaApiResponse> disputasAbiertas() {
        return disputas.listarAbiertas().stream().map(DisputaApiResponse::from).toList();
    }

    /** RF-F1-25: historial completo de disputas para auditoria. */
    @GetMapping("/disputas")
    public List<DisputaApiResponse> disputas() {
        return disputas.listarTodas().stream().map(DisputaApiResponse::from).toList();
    }

    /**
     * RF-F1-25: resuelve con acuerdo (FINALIZADA) o sin acuerdo (CANCELADA sin
     * cobro, motivo auditado).
     */
    @PostMapping("/disputas/{id}/resolver")
    public ResponseEntity<DisputaApiResponse> resolver(@PathVariable DisputaId id,
            @Valid @RequestBody ResolverDisputaApiRequest request) {
        return ResponseEntity.ok(DisputaApiResponse.from(
                disputas.resolver(id, Boolean.TRUE.equals(request.conAcuerdo()),
                        request.resolucion())));
    }
}
