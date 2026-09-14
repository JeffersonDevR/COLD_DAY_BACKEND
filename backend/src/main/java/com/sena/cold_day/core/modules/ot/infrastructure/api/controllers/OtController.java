package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.ot.application.dto.DiagnosticoRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.usecases.AprobarPresupuestoUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.CancelarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.ConsultarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.CrearOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.FinalizarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.IniciarDesplazamientoUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.RechazarPresupuestoUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.RegistrarDiagnosticoUseCase;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.CancelarOtApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.DiagnosticoApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.OtApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.RechazoPresupuestoApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.HistorialEstadoApiResponse;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * OT REST surface: creation/read/history (PR5), dispatch acceptance (PR6) and
 * the diagnosis/budget, approval/rejection, finalize and cancellation surface
 * (PR7). The state machine and the assigned-technician/client ownership guards
 * are enforced by the use cases.
 */
@RestController
@RequestMapping("/api/ot")
public class OtController {

    private final CrearOtUseCase crear;
    private final ConsultarOtUseCase consultar;
    private final CancelarOtUseCase cancelar;
    private final IniciarDesplazamientoUseCase iniciarDesplazamiento;
    private final RegistrarDiagnosticoUseCase registrarDiagnostico;
    private final AprobarPresupuestoUseCase aprobarPresupuesto;
    private final RechazarPresupuestoUseCase rechazarPresupuesto;
    private final FinalizarOtUseCase finalizar;

    @SuppressWarnings("java:S107") // Superficie REST cohesiva de OT (8 casos de uso del mismo agregado). Dividir el controller romperia la cohesion por recurso /api/ot; la alternativa Facade solo moveria los 8 params a otro ctor.
    public OtController(CrearOtUseCase crear, ConsultarOtUseCase consultar, CancelarOtUseCase cancelar,
            IniciarDesplazamientoUseCase iniciarDesplazamiento,
            RegistrarDiagnosticoUseCase registrarDiagnostico,
            AprobarPresupuestoUseCase aprobarPresupuesto,
            RechazarPresupuestoUseCase rechazarPresupuesto, FinalizarOtUseCase finalizar) {
        this.crear = crear;
        this.consultar = consultar;
        this.cancelar = cancelar;
        this.iniciarDesplazamiento = iniciarDesplazamiento;
        this.registrarDiagnostico = registrarDiagnostico;
        this.aprobarPresupuesto = aprobarPresupuesto;
        this.rechazarPresupuesto = rechazarPresupuesto;
        this.finalizar = finalizar;
    }

    /** The cliente is resolved from the principal; all Phase-1 orders are urgent. */
    @PostMapping
    public ResponseEntity<OtApiResponse> crear(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody OtApiRequest request) {
        OtResponse created = crear.crear(new OtRequest(request.categoriaServicio(), request.descripcionFalla(),
                request.evidenciaUrls(), request.direccion(), request.toPoint()), principal.usuarioId());
        return ResponseEntity.created(URI.create("/api/ot/" + created.id().valor()))
                .body(OtApiResponse.from(created));
    }

    @GetMapping("/{id}")
    public OtApiResponse consultar(@PathVariable OtId id) {
        return OtApiResponse.from(consultar.consultar(id));
    }

    @GetMapping("/{id}/historial")
    public List<HistorialEstadoApiResponse> historial(@PathVariable OtId id) {
        return consultar.historial(id).stream().map(HistorialEstadoApiResponse::from).toList();
    }

    /** RF-F1-10: the assigned technician starts the displacement. */
    @PostMapping("/{id}/iniciar-desplazamiento")
    @PreAuthorize("hasRole('TECNICO')")
    public OtApiResponse iniciarDesplazamiento(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId id) {
        return OtApiResponse.from(iniciarDesplazamiento.iniciar(principal.usuarioId(), id));
    }

    /** RF-F1-11: the assigned technician records the fault and presents the budget. */
    @PostMapping("/{id}/diagnostico")
    @PreAuthorize("hasRole('TECNICO')")
    public OtApiResponse registrarDiagnostico(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId id, @Valid @RequestBody DiagnosticoApiRequest request) {
        DiagnosticoRequest diagnostico = new DiagnosticoRequest(request.fallaDetectada(),
                request.observaciones(), request.costoManoObra(), request.costoRepuestos());
        return OtApiResponse.from(registrarDiagnostico.registrar(principal.usuarioId(), id, diagnostico));
    }

    /** RF-F1-20: the owning client approves the budget ({@code EN_REPARACION}). */
    @PostMapping("/{id}/presupuesto/aprobar")
    @PreAuthorize("hasRole('CLIENTE')")
    public OtApiResponse aprobarPresupuesto(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId id) {
        return OtApiResponse.from(aprobarPresupuesto.aprobar(principal.usuarioId(), id));
    }

    /** RF-F1-20/D1: rejection terminates the OT as CANCELADA with the visit fee. */
    @PostMapping("/{id}/presupuesto/rechazar")
    @PreAuthorize("hasRole('CLIENTE')")
    public OtApiResponse rechazarPresupuesto(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable OtId id, @RequestBody(required = false) RechazoPresupuestoApiRequest request) {
        String razon = request == null ? null : request.motivo();
        return OtApiResponse.from(rechazarPresupuesto.rechazar(principal.usuarioId(), id, razon));
    }

    /** RF-F1-10: the assigned technician finishes the repair. */
    @PostMapping("/{id}/finalizar")
    @PreAuthorize("hasRole('TECNICO')")
    public OtApiResponse finalizar(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable OtId id) {
        return OtApiResponse.from(finalizar.finalizar(principal.usuarioId(), id));
    }

    /**
     * RF-F1-21: cancellation with a mandatory reason, rejected once repair has
     * started. The owning client (free window) or the assigned technician may
     * cancel.
     */
    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyRole('CLIENTE','TECNICO')")
    public OtApiResponse cancelar(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable OtId id,
            @RequestBody(required = false) CancelarOtApiRequest request) {
        String razon = request == null ? null : request.motivo();
        return OtApiResponse.from(cancelar.cancelar(principal.usuarioId(), principal.rol(), id, razon));
    }
}
