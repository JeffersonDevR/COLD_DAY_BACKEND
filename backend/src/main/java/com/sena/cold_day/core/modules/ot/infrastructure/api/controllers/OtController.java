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

import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.usecases.CancelarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.ConsultarOtUseCase;
import com.sena.cold_day.core.modules.ot.application.usecases.CrearOtUseCase;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.OtApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.HistorialEstadoApiResponse;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * OT REST surface owned by PR5: creation (RF-F1-08), read by id, history
 * (RNF-09) and the state-machine-guarded cancellation seam. Dispatch (PR6) and
 * diagnosis/budget (PR7) endpoints are owned by later slices.
 */
@RestController
@RequestMapping("/api/ot")
public class OtController {

    private final CrearOtUseCase crear;
    private final ConsultarOtUseCase consultar;
    private final CancelarOtUseCase cancelar;

    public OtController(CrearOtUseCase crear, ConsultarOtUseCase consultar, CancelarOtUseCase cancelar) {
        this.crear = crear;
        this.consultar = consultar;
        this.cancelar = cancelar;
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

    /**
     * PR5 seam: only the state-machine guard is enforced here. PR7 adds the
     * mandatory reason, free window and visit fee (task 7.6).
     */
    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyRole('CLIENTE','TECNICO')")
    public OtApiResponse cancelar(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable OtId id) {
        ActorOt actor = principal.rol() == Rol.CLIENTE ? ActorOt.CLIENTE : ActorOt.TECNICO;
        MotivoCancelacion motivo = actor == ActorOt.CLIENTE
                ? MotivoCancelacion.CANCELACION_CLIENTE
                : MotivoCancelacion.CANCELACION_TECNICO;
        return OtApiResponse.from(cancelar.cancelar(id, actor, motivo));
    }
}
