package com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteOnboardingRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.application.usecases.RegistrarClienteUseCase;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.requests.ClienteOnboardingApiRequest;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.responses.ClienteApiResponse;
import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.ActualizarUbicacionClienteUseCase;
import com.sena.cold_day.core.modules.geolocalizacion.infrastructure.api.requests.UbicacionApiRequest;
import com.sena.cold_day.core.modules.ot.application.usecases.ListarOtUseCase;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final RegistrarClienteUseCase registrar;
    private final ActualizarUbicacionClienteUseCase actualizarUbicacion;
    private final ListarOtUseCase listarOts;

    public ClienteController(RegistrarClienteUseCase registrar,
            ActualizarUbicacionClienteUseCase actualizarUbicacion, ListarOtUseCase listarOts) {
        this.registrar = registrar;
        this.actualizarUbicacion = actualizarUbicacion;
        this.listarOts = listarOts;
    }

    /**
     * Alta pública de cliente: crea el Usuario (rol CLIENTE) y su perfil en una
     * sola transacción (mismo patrón que {@code POST /api/tecnicos}). Ya no
     * depende de un principal autenticado.
     */
    @PostMapping
    public ResponseEntity<ClienteApiResponse> crear(@Valid @RequestBody ClienteOnboardingApiRequest request) {
        ClienteResponse created = registrar.registrarNuevo(toApplicationRequest(request));
        return ResponseEntity.created(URI.create("/api/clientes/" + created.id().valor()))
                .body(ClienteApiResponse.from(created));
    }

    /**
     * RF-F1-06: the authenticated client captures its own coordinates,
     * preserving the textual address. Resolved from the principal.
     */
    @PutMapping("/me/ubicacion")
    public ResponseEntity<Void> actualizarUbicacion(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UbicacionApiRequest request) {
        actualizarUbicacion.actualizar(principal.usuarioId(), request.toPoint());
        return ResponseEntity.noContent().build();
    }

    /** Lists the OTs of the authenticated client (RF-F1-25). */
    @GetMapping("/me/ots")
    @PreAuthorize("hasRole('CLIENTE')")
    public List<OtApiResponse> misOts(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listarOts.listarPorCliente(principal.usuarioId()).stream()
                .map(resumen -> OtApiResponse.from(resumen.ot(), resumen.clienteNombre(), resumen.tecnicoNombre()))
                .toList();
    }

    private ClienteOnboardingRequest toApplicationRequest(ClienteOnboardingApiRequest request) {
        return new ClienteOnboardingRequest(request.nombre(), request.correo(), request.password(),
                request.telefono(), request.fotoUrl(), request.tipoCliente(), request.calle(), request.ciudad(),
                request.barrio(), request.ubicacion(), request.aceptaHabeasData());
    }
}
